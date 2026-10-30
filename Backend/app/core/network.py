"""IP real del cliente detrás de los proxies de confianza.

``X-Forwarded-For`` lo puede escribir cualquiera: el cliente manda el valor que quiera y
cada proxy AGREGA al final la IP de quien le habló. Por eso solo se confía en las últimas
``PROXY_TRUSTED_HOPS`` entradas, las que agregaron nuestros propios proxies:

    X-Forwarded-For: 1.2.3.4 (inventada por el cliente), 200.87.1.10 (agregada por Google)

Con PROXY_TRUSTED_HOPS=1 (Cloud Run) la IP real es 200.87.1.10. Con 0 (desarrollo) se
ignora el encabezado y se usa la conexión directa.
"""

import ipaddress

from fastapi import Request

from app.core.config import settings


def client_ip(request: Request, trusted_hops: int | None = None) -> str | None:
    hops = settings.proxy_trusted_hops if trusted_hops is None else trusted_hops
    peer = request.client.host if request.client else None
    if hops <= 0:
        return peer

    forwarded = request.headers.get("x-forwarded-for", "")
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    if len(chain) < hops:
        return peer

    candidate = chain[-hops]
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return peer
