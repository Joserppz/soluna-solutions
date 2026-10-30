"""Envío de correos transaccionales (verificación de correo y recuperación de contraseña).

EMAIL_PROVIDER elige el servicio:
- console: escribe el correo en el log (solo desarrollo; prohibido con ENV=prod).
- resend:  API de Resend (https://resend.com), requiere RESEND_API_KEY y dominio verificado.
- brevo:   API de Brevo (https://brevo.com), requiere BREVO_API_KEY y remitente verificado.
"""

import logging
from dataclasses import dataclass
from email.utils import parseaddr
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger("aspar.email")


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """Desarrollo: el correo (con su enlace) aparece en los logs de la API."""

    def send(self, message: EmailMessage) -> None:
        logger.info(
            "Correo de desarrollo para %s: %s\n%s", message.to, message.subject, message.text
        )


class ResendEmailSender:
    def __init__(self, api_key: str, sender: str, client: httpx.Client | None = None) -> None:
        self.api_key, self.sender = api_key, sender
        self.client = client or httpx.Client(timeout=15)

    def send(self, message: EmailMessage) -> None:
        response = self.client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "from": self.sender,
                "to": [message.to],
                "subject": message.subject,
                "text": message.text,
            },
        )
        response.raise_for_status()


class BrevoEmailSender:
    def __init__(self, api_key: str, sender: str, client: httpx.Client | None = None) -> None:
        self.api_key = api_key
        self.sender_name, self.sender_email = parseaddr(sender)
        self.client = client or httpx.Client(timeout=15)

    def send(self, message: EmailMessage) -> None:
        response = self.client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": self.api_key},
            json={
                "sender": {"name": self.sender_name or "ASPAR", "email": self.sender_email},
                "to": [{"email": message.to}],
                "subject": message.subject,
                "textContent": message.text,
            },
        )
        response.raise_for_status()


def get_email_sender() -> EmailSender:
    if settings.email_provider == "resend":
        return ResendEmailSender(settings.resend_api_key.get_secret_value(), settings.email_from)
    if settings.email_provider == "brevo":
        return BrevoEmailSender(settings.brevo_api_key.get_secret_value(), settings.email_from)
    return ConsoleEmailSender()
