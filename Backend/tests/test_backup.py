"""scripts.backup_db: respaldo cifrado con la clave pública (ADR-014)."""

import datetime as dt
import io
import json
import shutil
import subprocess
import tarfile

import httpx
import pytest

from scripts import backup_db
from tests.conftest import TEST_DATABASE_URL, requires_db

NOW = dt.datetime(2026, 11, 1, 3, 7, tzinfo=backup_db.BOLIVIA)


@pytest.fixture(scope="module")
def keys():
    return backup_db.generate_keys(b"frase-de-prueba")


def fake_pg_dump(calls):
    def run(command, **kwargs):
        calls.append((command, kwargs["env"]))
        target = command[command.index("--file") + 1]
        with open(target, "wb") as file:
            file.write(b"PGDMP-contenido-de-prueba")
        return subprocess.CompletedProcess(command, 0, "", "")

    return run


def open_backup(path, private_pem):
    data = backup_db.decrypt(path.read_bytes(), private_pem, b"frase-de-prueba")
    return tarfile.open(fileobj=io.BytesIO(data), mode="r:gz"), data


def test_cifrar_y_descifrar(keys):
    private_pem, public_pem = keys

    blob = backup_db.encrypt(b"datos clinicos", public_pem)

    assert blob.startswith(backup_db.MAGIC) and b"datos clinicos" not in blob
    assert backup_db.decrypt(blob, private_pem, b"frase-de-prueba") == b"datos clinicos"


def test_la_clave_publica_no_descifra_y_otra_privada_tampoco(keys):
    private_pem, public_pem = keys
    other_private, _ = backup_db.generate_keys(None)
    blob = backup_db.encrypt(b"datos", public_pem)

    with pytest.raises(backup_db.BackupError, match="no corresponden"):
        backup_db.decrypt(blob, other_private, None)
    with pytest.raises(backup_db.BackupError, match="no corresponden"):
        backup_db.decrypt(blob, private_pem, b"frase-equivocada")
    with pytest.raises(backup_db.BackupError, match="no corresponden"):
        backup_db.decrypt(blob[:-10] + b"x" * 10, private_pem, b"frase-de-prueba")
    with pytest.raises(backup_db.BackupError, match="no es un respaldo"):
        backup_db.decrypt(b"otra cosa", private_pem, None)


def test_rechaza_claves_debiles_o_invalidas():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    weak = (
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
        .public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    )

    with pytest.raises(backup_db.BackupError, match="3072"):
        backup_db.encrypt(b"x", weak)
    with pytest.raises(backup_db.BackupError, match="PEM"):
        backup_db.encrypt(b"x", b"no es una clave")


def test_la_contrasena_no_va_en_la_linea_de_comandos(tmp_path, keys):
    calls = []

    backup_db.create_backup(
        tmp_path,
        database_url="postgresql://aspar_backup:cl%40ve-secreta@db.ejemplo.com:5432/postgres",
        public_pem=keys[1],
        run=fake_pg_dump(calls),
        now=NOW,
    )

    command, env = calls[0]
    assert "cl@ve-secreta" not in " ".join(command)
    assert "postgresql://aspar_backup@db.ejemplo.com:5432/postgres" in command
    assert env["PGPASSWORD"] == "cl@ve-secreta"
    assert {"--format=custom", "--no-owner", "--no-privileges", "--schema=public"} <= set(command)


def test_respaldo_con_base_documentos_y_manifiesto(tmp_path, keys):
    files = {
        "p1/consentimiento.pdf": b"%PDF-1",
        "p1/ci.jpg": b"\xff\xd8\xff",
        "p2/cert.pdf": b"%PDF-2",
    }

    def storage(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer service-key"
        if "/object/list/" in request.url.path:
            body = json.loads(request.content)
            if body["prefix"] == "":
                return httpx.Response(
                    200, json=[{"name": "p1", "id": None}, {"name": "p2", "id": None}]
                )
            return httpx.Response(
                200,
                json=[
                    {"name": name.split("/", 1)[1], "id": "x"}
                    for name in files
                    if name.startswith(body["prefix"] + "/")
                ],
            )
        path = request.url.path.split("/documentos-pacientes/", 1)[1]
        return httpx.Response(200, content=files[path])

    store = backup_db.DocumentStore(
        "https://ref.supabase.co",
        "service-key",
        "documentos-pacientes",
        httpx.Client(transport=httpx.MockTransport(storage)),
    )

    target = backup_db.create_backup(
        tmp_path / "respaldos",
        database_url="postgresql://u:p@h/d",
        public_pem=keys[1],
        documents=store,
        run=fake_pg_dump([]),
        now=NOW,
    )

    assert target.name == "aspar-respaldo-2026-11-01.tar.gz.enc"
    assert oct(target.stat().st_mode & 0o777) == "0o600"
    archive, data = open_backup(target, keys[0])
    names = set(archive.getnames())
    assert {
        "base.dump",
        "manifiesto.json",
        "documentos/p1/ci.jpg",
        "documentos/p2/cert.pdf",
    } <= names
    assert archive.extractfile("base.dump").read() == b"PGDMP-contenido-de-prueba"
    manifest = backup_db.read_manifest(data)
    assert manifest["creado"].startswith("2026-11-01T03:07")
    assert {d["ruta"] for d in manifest["documentos"]} == set(files)


def test_errores_de_pg_dump(tmp_path, keys):
    def failing(command, **kwargs):
        raise subprocess.CalledProcessError(
            1, command, stderr="FATAL: password authentication failed"
        )

    def missing(command, **kwargs):
        raise FileNotFoundError("pg_dump")

    with pytest.raises(backup_db.BackupError, match="password authentication failed"):
        backup_db.create_backup(
            tmp_path, database_url="postgresql://u:p@h/d", public_pem=keys[1], run=failing
        )
    with pytest.raises(backup_db.BackupError, match="postgresql-client"):
        backup_db.create_backup(
            tmp_path, database_url="postgresql://u:p@h/d", public_pem=keys[1], run=missing
        )


def test_linea_de_comandos_sin_variables(monkeypatch, tmp_path, capsys):
    for name in ("BACKUP_DATABASE_URL", "MIGRATION_DATABASE_URL", "BACKUP_PUBLIC_KEY"):
        monkeypatch.delenv(name, raising=False)

    code = backup_db.main(["create", "--output", str(tmp_path)])

    assert code == 1
    assert "Falta la variable de entorno BACKUP_DATABASE_URL" in capsys.readouterr().err


def test_keygen_y_decrypt_desde_la_linea_de_comandos(monkeypatch, tmp_path, keys):
    monkeypatch.setattr(backup_db.getpass, "getpass", lambda _prompt: "")
    assert backup_db.main(["keygen", "--output", str(tmp_path / "claves")]) == 0
    public = (tmp_path / "claves" / "aspar-respaldo-publica.pem").read_bytes()
    private = tmp_path / "claves" / "aspar-respaldo-privada.pem"
    assert oct(private.stat().st_mode & 0o777) == "0o600"
    target = backup_db.create_backup(
        tmp_path,
        database_url="postgresql://u:p@h/d",
        public_pem=public,
        run=fake_pg_dump([]),
        now=NOW,
    )

    code = backup_db.main(
        [
            "decrypt",
            str(target),
            "--private-key",
            str(private),
            "--output",
            str(tmp_path / "r.tar.gz"),
        ]
    )

    assert code == 0
    with tarfile.open(tmp_path / "r.tar.gz") as archive:
        assert archive.getnames()[0] == "base.dump"


PG_DUMP = shutil.which("pg_dump")
PG_RESTORE = shutil.which("pg_restore")


def _pg_dump_major() -> int:
    out = subprocess.run([PG_DUMP, "--version"], capture_output=True, text=True).stdout  # noqa: S603
    return int(out.split()[-1].split(".")[0])


@requires_db
@pytest.mark.skipif(not (PG_DUMP and PG_RESTORE), reason="Requiere pg_dump y pg_restore")
def test_respaldo_real_de_la_base_de_pruebas_se_puede_restaurar(migrated_engine, tmp_path, keys):
    from sqlalchemy import text

    with migrated_engine.connect() as conn:
        server_major = int(conn.execute(text("show server_version")).scalar().split(".")[0])
    if _pg_dump_major() < server_major:
        pytest.skip("pg_dump es más antiguo que el servidor")

    target = backup_db.create_backup(
        tmp_path, database_url=TEST_DATABASE_URL, public_pem=keys[1], now=NOW
    )
    archive, _ = open_backup(target, keys[0])
    dump = tmp_path / "base.dump"
    dump.write_bytes(archive.extractfile("base.dump").read())
    listing = subprocess.run(  # noqa: S603
        [PG_RESTORE, "--list", str(dump)], capture_output=True, text=True
    )

    assert listing.returncode == 0
    assert "TABLE DATA public patients" in listing.stdout
    assert "TABLE DATA public audit_logs" in listing.stdout
