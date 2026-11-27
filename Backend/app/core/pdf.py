"""Reportes en PDF: el mismo contenido de la descarga en Excel, listo para imprimir o
enviar sin que se pueda modificar.

Cada página lleva la marca de ASPAR, el nombre del reporte y el número de página; la
primera, además, el filtro aplicado, cuántas filas trae, quién lo descargó y cuándo. Las
tablas repiten el encabezado en cada página. Con más de seis columnas la hoja va
horizontal. Usa las fuentes estándar del PDF (cubren el español completo), así el archivo
pesa poco y no depende de fuentes instaladas en el servidor.
"""

import datetime as dt
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

from fpdf import FPDF, FontFace
from fpdf.enums import TableBordersLayout, TableCellFillMode

from app.core import clock

PDF_MEDIA_TYPE = "application/pdf"

LOGO = Path(__file__).resolve().parent.parent / "assets" / "marca-aspar.png"

# Colores de la marca (los mismos del sitio)
VERDE = (7, 57, 48)
GUINDO = (109, 22, 25)
TEXTO = (38, 38, 36)
SUAVE = (110, 106, 98)
LINEA = (221, 215, 204)
FILA_ALTERNA = (247, 244, 238)

FONT = "Helvetica"
MARGIN = 14
LANDSCAPE_FROM = 7  # columnas

# Las fuentes estándar del PDF usan Latin-1: tiene todo el español (tildes, ñ, ¿¡, «»).
# Lo poco que falta se reemplaza por su equivalente.
_REPLACEMENTS = str.maketrans(
    {
        "–": "-",
        "—": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "…": "...",
        "•": "·",
        "→": "->",
        " ": " ",
        " ": " ",
    }
)


def text(value: object) -> str:
    """Un valor de celda como texto que la fuente del PDF puede dibujar."""
    if value is None:
        return ""
    if isinstance(value, bool):
        value = "Sí" if value else "No"
    elif isinstance(value, int | float):
        value = number(value)
    elif isinstance(value, dt.datetime):
        value = value.astimezone(clock.BOLIVIA).strftime("%d/%m/%Y %H:%M")
    elif isinstance(value, dt.date):
        value = value.strftime("%d/%m/%Y")
    clean = str(value).translate(_REPLACEMENTS).replace("\r", " ").replace("\n", " ")
    return clean.encode("latin-1", "replace").decode("latin-1")


def number(value: float | int) -> str:
    """Números como se escriben en Bolivia: 18.500 · 1.250,50."""
    if isinstance(value, float) and not value.is_integer():
        whole, _, cents = f"{value:,.2f}".partition(".")
        return f"{whole.replace(',', '.')},{cents}"
    return f"{int(value):,}".replace(",", ".")


@dataclass
class PdfTable:
    headers: Sequence[str]
    rows: list[Sequence[object]] = field(default_factory=list)
    heading: str | None = None  # subtítulo de la tabla (cuando el reporte tiene varias)
    empty: str = "No hay filas con este filtro."


@dataclass
class PdfReport:
    title: str  # «Afiliados», «Resumen de donaciones de noviembre de 2026»
    tables: Sequence[PdfTable]
    filters: str = "sin filtros"
    rows: int | None = None  # filas que cuenta la descarga
    author: str | None = None  # quién lo descargó
    facts: Sequence[tuple[str, str]] = ()  # cifras destacadas arriba (resumen del mes)
    generated: dt.datetime = field(default_factory=clock.now)


class _Document(FPDF):
    def __init__(self, report: PdfReport, landscape: bool) -> None:
        super().__init__(orientation="L" if landscape else "P", unit="mm", format="A4")
        self.report = report
        self.set_margins(MARGIN, MARGIN, MARGIN)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_title(text(f"ASPAR - {report.title}"))
        self.set_author("ASPAR")
        self.set_creator("Sistema ASPAR")
        self.alias_nb_pages()

    def header(self) -> None:
        top = self.get_y()
        if LOGO.exists():
            self.image(str(LOGO), x=MARGIN, y=top - 1, h=11)
        self.set_xy(MARGIN + 10, top)
        self.set_font(FONT, "B", 11)
        self.set_text_color(*VERDE)
        self.cell(0, 5, "ASPAR", new_x="LMARGIN", new_y="NEXT")
        self.set_x(MARGIN + 10)
        self.set_font(FONT, "", 8)
        self.set_text_color(*SUAVE)
        self.cell(0, 4, text("Asociación de Parkinson «Mario Lagrava»"))
        # Nombre del reporte a la derecha en las páginas siguientes
        if self.page_no() > 1:
            self.set_xy(MARGIN, top + 1)
            self.set_font(FONT, "", 9)
            self.set_text_color(*SUAVE)
            self.cell(0, 5, text(self.report.title), align="R")
        self.set_y(top + 13)
        self.set_draw_color(*LINEA)
        self.set_line_width(0.3)
        self.line(MARGIN, self.get_y(), self.w - MARGIN, self.get_y())
        self.ln(5)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font(FONT, "", 7.5)
        self.set_text_color(*SUAVE)
        self.cell(
            0,
            4,
            text(
                "Uso interno de ASPAR. Puede contener datos personales: "
                "no lo compartas fuera del equipo."
            ),
        )
        self.set_x(MARGIN)
        self.cell(0, 4, f"Página {self.page_no()} de {{nb}}", align="R")


def _intro(pdf: _Document, report: PdfReport) -> None:
    pdf.set_font(FONT, "B", 17)
    pdf.set_text_color(*VERDE)
    pdf.multi_cell(0, 8, text(report.title), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1.5)
    details = [("Filtro", report.filters)]
    if report.rows is not None:
        details.append(("Filas", number(report.rows)))
    generated = f"{report.generated.astimezone(clock.BOLIVIA):%d/%m/%Y %H:%M}"
    details.append(("Generado", f"{generated} por {report.author}" if report.author else generated))
    for label, value in details:
        pdf.set_font(FONT, "B", 8.5)
        pdf.set_text_color(*TEXTO)
        pdf.cell(18, 4.6, text(label))
        pdf.set_font(FONT, "", 8.5)
        pdf.set_text_color(*SUAVE)
        pdf.multi_cell(0, 4.6, text(value), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    if report.facts:
        _facts(pdf, report.facts)


def _facts(pdf: _Document, facts: Sequence[tuple[str, str]]) -> None:
    """Cifras destacadas en recuadros, de a cuatro por fila."""
    per_row = 4
    gap = 3
    width = (pdf.epw - gap * (per_row - 1)) / per_row
    for start in range(0, len(facts), per_row):
        y = pdf.get_y()
        for index, (label, value) in enumerate(facts[start : start + per_row]):
            x = MARGIN + index * (width + gap)
            pdf.set_fill_color(*FILA_ALTERNA)
            pdf.set_draw_color(*LINEA)
            pdf.rect(x, y, width, 15, style="DF")
            pdf.set_xy(x + 3, y + 2.2)
            pdf.set_font(FONT, "", 7.5)
            pdf.set_text_color(*SUAVE)
            pdf.cell(width - 6, 4, text(label))
            pdf.set_xy(x + 3, y + 6.8)
            pdf.set_font(FONT, "B", 12)
            pdf.set_text_color(*GUINDO)
            pdf.cell(width - 6, 6, text(value))
        pdf.set_y(y + 15 + gap)
    pdf.ln(3)


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _widths(pdf: _Document, table: PdfTable) -> list[float]:
    """Ancho de cada columna medido con la fuente: los números, fechas y textos cortos
    entran en una línea; si no alcanza el ancho de la hoja, se angostan las columnas de
    texto largo (que pueden partirse en palabras) antes que las demás."""
    pad = 2 * 1.8 + 2 * pdf.c_margin + 0.6  # relleno de la celda y margen interno del texto
    natural, minimum = [], []
    sample = table.rows[:400]
    for index, header in enumerate(table.headers):
        pdf.set_font(FONT, "", 8)
        cells = [text(row[index]) for row in sample if index < len(row)]
        widest = max((pdf.get_string_width(cell) for cell in cells), default=0)
        widest_word = max(
            (pdf.get_string_width(word) for cell in cells for word in cell.split()), default=0
        )
        pdf.set_font(FONT, "B", 8)
        head = pdf.get_string_width(text(header))
        head_word = max((pdf.get_string_width(word) for word in text(header).split()), default=0)
        natural.append(min(max(widest, head if head < 28 else head_word), 70) + pad)
        minimum.append(min(max(widest_word, head_word, 8), 34) + pad)
    total = pdf.epw
    if sum(natural) <= total:
        extra = total - sum(natural)
        return [width + extra * width / sum(natural) for width in natural]
    room = total - sum(minimum)
    if room <= 0:
        return [width * total / sum(minimum) for width in minimum]
    flexible = [nat - low for nat, low in zip(natural, minimum, strict=True)]
    share = room / sum(flexible)
    return [low + flex * share for low, flex in zip(minimum, flexible, strict=True)]


def _table(pdf: _Document, table: PdfTable) -> None:
    if table.heading:
        pdf.set_font(FONT, "B", 11)
        pdf.set_text_color(*VERDE)
        pdf.cell(0, 7, text(table.heading), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    if not table.rows:
        pdf.set_font(FONT, "I", 9)
        pdf.set_text_color(*SUAVE)
        pdf.cell(0, 6, text(table.empty), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)
        return
    numeric = [
        all(_is_number(row[index]) or row[index] in (None, "") for row in table.rows)
        and any(_is_number(row[index]) for row in table.rows)
        for index in range(len(table.headers))
    ]
    widths = _widths(pdf, table)
    pdf.set_font(FONT, "", 8)
    pdf.set_text_color(*TEXTO)
    pdf.set_draw_color(*LINEA)
    with pdf.table(
        col_widths=widths,
        width=pdf.epw,
        text_align=["RIGHT" if is_number else "LEFT" for is_number in numeric],
        line_height=4.2,
        padding=(1.6, 1.8),
        borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        cell_fill_color=FILA_ALTERNA,
        cell_fill_mode=TableCellFillMode.EVEN_ROWS,
        headings_style=FontFace(emphasis="BOLD", color=(255, 255, 255), fill_color=VERDE),
        repeat_headings=1,
    ) as grid:
        grid.row([text(header) for header in table.headers])
        for values in table.rows:
            grid.row([text(value) for value in values])
    pdf.ln(6)


def pdf_bytes(report: PdfReport) -> bytes:
    columns = max((len(table.headers) for table in report.tables), default=0)
    pdf = _Document(report, landscape=columns >= LANDSCAPE_FROM)
    pdf.add_page()
    _intro(pdf, report)
    for table in report.tables:
        _table(pdf, table)
    return bytes(pdf.output())
