"""Respaldo cifrado de la base y de los documentos privados (ADR-014).

El respaldo se cifra con la clave PÚBLICA de la asociación: quien lo genera (GitHub
Actions o un servidor) puede cifrar, pero no descifrar. La clave privada queda fuera
de línea, con la dirección del proyecto. Los respaldos tienen datos clínicos (RNF-06).

Uso (desde la carpeta Backend):
    python -m scripts.backup_db keygen --output claves/        # una sola vez
    python -m scripts.backup_db create --output respaldos/ [--with-documents]
    python -m scripts.backup_db decrypt respaldos/aspar-respaldo-AAAA-MM-DD.tar.gz.enc \\
        --private-key claves/aspar-respaldo-privada.pem --output respaldo.tar.gz

Variables de entorno de «create»:
    BACKUP_DATABASE_URL     conexión con permiso de lectura (si falta, MIGRATION_DATABASE_URL)
    BACKUP_PUBLIC_KEY       clave pública PEM (el contenido del archivo, no la ruta)
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PATIENT_DOCUMENTS_BUCKET  (con --with-documents)
    PG_DUMP                 ruta de pg_dump (por defecto «pg_dump»)

Para restaurar (docs/despliegue/GUIA_DE_DESPLIEGUE.md, sección 8): descifrar,
``tar -xzf respaldo.tar.gz``, crear pg_trgm en el esquema extensions del destino y
``pg_restore --clean --if-exists --no-owner --dbname "$DESTINO" base.dump``.
"""

import argparse
import datetime as dt
import getpass
import hashlib
import io
import json
import os
import struct
import subprocess
import sys
import tarfile
import tempfile
from collections.abc import Callable
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import httpx
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

MAGIC = b"ASPARBK1"
BOLIVIA = dt.timezone(dt.timedelta(hours=-4))
OAEP = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None
)
LIST_PAGE = 1000


class BackupError(Exception):
    pass


# ---------------------------------------------------------------------------
# Claves y cifrado: Fernet (AES-128-CBC + HMAC) con una clave nueva por respaldo,
# envuelta con RSA-OAEP-SHA256 de 4096 bits
# ---------------------------------------------------------------------------
def generate_keys(passphrase: bytes | None) -> tuple[bytes, bytes]:
    """Devuelve (privada PEM, pública PEM). La privada se protege con la frase si se da."""
    private = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    encryption = (
        serialization.BestAvailableEncryption(passphrase)
        if passphrase
        else serialization.NoEncryption()
    )
    private_pem = private.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, encryption
    )
    public_pem = private.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private_pem, public_pem


def encrypt(data: bytes, public_pem: bytes) -> bytes:
    try:
        public_key = serialization.load_pem_public_key(public_pem)
    except ValueError as exc:
        raise BackupError("BACKUP_PUBLIC_KEY no es una clave pública PEM válida.") from exc
    if not isinstance(public_key, rsa.RSAPublicKey) or public_key.key_size < 3072:
        raise BackupError("La clave pública debe ser RSA de al menos 3072 bits.")
    data_key = Fernet.generate_key()
    wrapped = public_key.encrypt(data_key, OAEP)
    return MAGIC + struct.pack(">H", len(wrapped)) + wrapped + Fernet(data_key).encrypt(data)


def decrypt(blob: bytes, private_pem: bytes, passphrase: bytes | None) -> bytes:
    if not blob.startswith(MAGIC):
        raise BackupError("El archivo no es un respaldo de ASPAR.")
    (size,) = struct.unpack(">H", blob[len(MAGIC) : len(MAGIC) + 2])
    start = len(MAGIC) + 2
    wrapped, token = blob[start : start + size], blob[start + size :]
    try:
        private_key = serialization.load_pem_private_key(private_pem, password=passphrase)
        data_key = private_key.decrypt(wrapped, OAEP)
        return Fernet(data_key).decrypt(token)
    except (ValueError, TypeError, InvalidToken) as exc:
        raise BackupError(
            "No se pudo descifrar: la clave privada o su frase no corresponden a este respaldo, "
            "o el archivo está dañado."
        ) from exc


# ---------------------------------------------------------------------------
# Base de datos: pg_dump sin la contraseña en la línea de comandos
# ---------------------------------------------------------------------------
Runner = Callable[..., subprocess.CompletedProcess]


def split_password(url: str) -> tuple[str, str | None]:
    """Quita la contraseña de la URL (iría a PGPASSWORD, no a la lista de procesos)."""
    parts = urlsplit(url)
    if parts.password is None:
        return url, None
    host = parts.hostname or ""
    user = quote(unquote(parts.username or ""), safe="")
    netloc = f"{user}@{host}" + (f":{parts.port}" if parts.port else "")
    return urlunsplit(parts._replace(netloc=netloc)), unquote(parts.password)


def dump_database(url: str, target: Path, run: Runner = subprocess.run) -> None:
    clean_url, password = split_password(url)
    env = os.environ.copy()
    if password is not None:
        env["PGPASSWORD"] = password
    command = [
        os.environ.get("PG_DUMP", "pg_dump"),
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        # Solo los datos de ASPAR: en Supabase los esquemas auth, storage, realtime… son
        # del servicio y un usuario de respaldo no tiene permiso para leerlos
        "--schema=public",
        "--file",
        str(target),
        "--dbname",
        clean_url,
    ]
    try:
        run(command, check=True, env=env, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise BackupError("No se encontró pg_dump: instala postgresql-client.") from exc
    except subprocess.CalledProcessError as exc:
        # El error de pg_dump no lleva la contraseña: va en PGPASSWORD
        raise BackupError(f"pg_dump falló: {(exc.stderr or '').strip()[:500]}") from exc


# ---------------------------------------------------------------------------
# Documentos privados (bucket de Supabase Storage)
# ---------------------------------------------------------------------------
class DocumentStore:
    def __init__(self, base_url: str, service_key: str, bucket: str, client: httpx.Client):
        self.base_url = base_url.rstrip("/")
        self.bucket = bucket
        self.client = client
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    def list_files(self, prefix: str = "") -> list[str]:
        """Todas las rutas del bucket (las carpetas vienen sin id y se recorren)."""
        files: list[str] = []
        offset = 0
        while True:
            response = self.client.post(
                f"{self.base_url}/storage/v1/object/list/{self.bucket}",
                headers=self.headers,
                json={"prefix": prefix, "limit": LIST_PAGE, "offset": offset},
            )
            response.raise_for_status()
            entries = response.json()
            for entry in entries:
                path = f"{prefix}/{entry['name']}" if prefix else entry["name"]
                if entry.get("id") is None:
                    files += self.list_files(path)
                else:
                    files.append(path)
            if len(entries) < LIST_PAGE:
                return files
            offset += LIST_PAGE

    def download(self, path: str) -> bytes:
        response = self.client.get(
            f"{self.base_url}/storage/v1/object/{self.bucket}/{quote(path)}", headers=self.headers
        )
        response.raise_for_status()
        return response.content


# ---------------------------------------------------------------------------
# Respaldo completo
# ---------------------------------------------------------------------------
def _add(archive: tarfile.TarFile, name: str, data: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = 0o600
    archive.addfile(info, io.BytesIO(data))


def create_backup(
    output_dir: Path,
    *,
    database_url: str,
    public_pem: bytes,
    documents: DocumentStore | None = None,
    run: Runner = subprocess.run,
    now: dt.datetime | None = None,
) -> Path:
    now = now or dt.datetime.now(BOLIVIA)
    manifest: dict = {"creado": now.isoformat(), "base": {}, "documentos": []}
    buffer = io.BytesIO()
    with tempfile.TemporaryDirectory() as tmp:
        dump = Path(tmp) / "base.dump"
        dump_database(database_url, dump, run)
        dump_bytes = dump.read_bytes()
        if not dump_bytes:
            raise BackupError("pg_dump no generó datos.")
        manifest["base"] = {
            "archivo": "base.dump",
            "sha256": hashlib.sha256(dump_bytes).hexdigest(),
        }
        with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
            _add(archive, "base.dump", dump_bytes)
            if documents is not None:
                for path in documents.list_files():
                    content = documents.download(path)
                    _add(archive, f"documentos/{path}", content)
                    manifest["documentos"].append(
                        {"ruta": path, "sha256": hashlib.sha256(content).hexdigest()}
                    )
            _add(archive, "manifiesto.json", json.dumps(manifest, indent=2).encode())

    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"aspar-respaldo-{now:%Y-%m-%d}.tar.gz.enc"
    target.write_bytes(encrypt(buffer.getvalue(), public_pem))
    target.chmod(0o600)
    return target


def read_manifest(archive_bytes: bytes) -> dict:
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as archive:
        member = archive.extractfile("manifiesto.json")
        if member is None:
            raise BackupError("El respaldo no tiene manifiesto.")
        return json.loads(member.read())


# ---------------------------------------------------------------------------
# Línea de comandos
# ---------------------------------------------------------------------------
def _env(name: str, fallback: str | None = None) -> str:
    value = os.environ.get(name) or (os.environ.get(fallback) if fallback else None)
    if not value:
        raise BackupError(f"Falta la variable de entorno {name}.")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Respaldo cifrado de ASPAR")
    commands = parser.add_subparsers(dest="command", required=True)
    keygen = commands.add_parser("keygen", help="crea el par de claves (una sola vez)")
    keygen.add_argument("--output", type=Path, required=True)
    create = commands.add_parser("create", help="genera un respaldo cifrado")
    create.add_argument("--output", type=Path, required=True)
    create.add_argument("--with-documents", action="store_true")
    restore = commands.add_parser("decrypt", help="descifra un respaldo")
    restore.add_argument("file", type=Path)
    restore.add_argument("--private-key", type=Path, required=True)
    restore.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)

    try:
        if args.command == "keygen":
            phrase = getpass.getpass("Frase para proteger la clave privada (vacía = sin frase): ")
            private_pem, public_pem = generate_keys(phrase.encode() or None)
            args.output.mkdir(parents=True, exist_ok=True)
            private_file = args.output / "aspar-respaldo-privada.pem"
            private_file.write_bytes(private_pem)
            private_file.chmod(0o600)
            (args.output / "aspar-respaldo-publica.pem").write_bytes(public_pem)
            print(f"Listo. Guarda {private_file} fuera de línea; nunca la subas a GitHub.")
            print("El contenido de aspar-respaldo-publica.pem va en el secreto BACKUP_PUBLIC_KEY.")
        elif args.command == "create":
            documents = None
            if args.with_documents:
                documents = DocumentStore(
                    _env("SUPABASE_URL"),
                    _env("SUPABASE_SERVICE_ROLE_KEY"),
                    os.environ.get("PATIENT_DOCUMENTS_BUCKET", "documentos-pacientes"),
                    httpx.Client(timeout=60),
                )
            target = create_backup(
                args.output,
                database_url=_env("BACKUP_DATABASE_URL", "MIGRATION_DATABASE_URL"),
                public_pem=_env("BACKUP_PUBLIC_KEY").encode(),
                documents=documents,
            )
            print(f"Respaldo cifrado: {target} ({target.stat().st_size} bytes)")
        else:
            phrase = getpass.getpass("Frase de la clave privada (vacía si no tiene): ")
            data = decrypt(
                args.file.read_bytes(), args.private_key.read_bytes(), phrase.encode() or None
            )
            args.output.write_bytes(data)
            args.output.chmod(0o600)
            manifest = read_manifest(data)
            print(
                f"Descifrado en {args.output}: respaldo del {manifest['creado']}, "
                f"{len(manifest['documentos'])} documento(s)."
            )
    except (BackupError, httpx.HTTPError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
