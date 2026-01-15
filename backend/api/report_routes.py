"""
Report Generation Module — Diagram 4.3.1.5
Export analysis results as CSV or PDF
"""
import io
import csv
import json
from flask import Blueprint, request, jsonify, send_file, make_response
from datetime import datetime
from database.mongodb_helper import db
from utils.error_handlers import handle_errors, APIError
from config import config

report_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

# ── Optional PDF generation (reportlab)
try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("⚠️  reportlab not installed — PDF export disabled. Run: pip install reportlab")

def _format_pdf_val(val):
    if isinstance(val, float):
        return f"{val:.2f}"
    if isinstance(val, str) and len(val) > 35:
        return val[:32] + '...'
    return str(val)

def _generate_csv_bytes(headers: list, rows: list) -> bytes:
    """Convert a list of dicts to CSV bytes in-memory."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode('utf-8')


def _generate_pdf_bytes(title: str, headers: list, rows: list, summary: dict = None, charts: list = None) -> bytes:
    """Generate a stunning, business-grade styled PDF report using ReportLab."""
    buffer = io.BytesIO()
    # Use landscape A4 to fit more columns professionally
    page_size = landscape(A4)
    doc = SimpleDocTemplate(buffer, pagesize=page_size,
                            rightMargin=40, leftMargin=40,
                            topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    elements = []

    # 1. Branding Header
    header_data = [
        [Paragraph("<b>AI RETAIL OPTIMIZATION SUITE</b>", ParagraphStyle('brand', fontSize=14, textColor=colors.white)),
         Paragraph(f"<font size=10>Generated: {datetime.now().strftime('%B %d, %Y - %H:%M')}</font>", ParagraphStyle('date', alignment=2, textColor=colors.whitesmoke))]
    ]
    header_table = Table(header_data, colWidths=[page_size[0]/2 - 40, page_size[0]/2 - 40])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1e40af')),
        ('PADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.4 * inch))

    # 2. Report Title
    title_style = ParagraphStyle('ReportTitle', parent=styles['Heading1'],
                                 fontSize=22, spaceAfter=12,
                                 textColor=colors.HexColor('#0f172a'), fontName='Helvetica-Bold')
    elements.append(Paragraph(title.upper(), title_style))
    elements.append(Spacer(1, 0.2 * inch))

    # 3. Executive Summary Box
    if summary:
        elements.append(Paragraph("<b>EXECUTIVE SUMMARY</b>", ParagraphStyle('SumHeading', fontSize=12, textColor=colors.HexColor('#3b82f6'), spaceAfter=8)))
        sum_data = []
        for k, v in summary.items():
            key_text = str(k).upper().replace('_', ' ')
            sum_data.append([
                Paragraph(f"<b>{key_text}:</b>", ParagraphStyle('SK', fontSize=10, textColor=colors.HexColor('#475569'))),
                Paragraph(str(v), ParagraphStyle('SV', fontSize=10, textColor=colors.HexColor('#0f172a')))
            ])
        
        if sum_data:
            sum_table = Table(sum_data, colWidths=[2.2*inch, page_size[0]-80-2.2*inch])
            sum_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
                ('PADDING', (0,0), (-1,-1), 8),
                ('LINEBELOW', (0,0), (-1,-2), 1, colors.white),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            elements.append(sum_table)
            elements.append(Spacer(1, 0.4 * inch))

    # 4. Key Visualizations (Charts)
    if charts:
        import base64
        from reportlab.platypus import Image as RLImage, KeepTogether

        heading = Paragraph("<b>KEY VISUALIZATIONS</b>", ParagraphStyle('ChartHeading', fontSize=12, textColor=colors.HexColor('#3b82f6'), spaceAfter=8))
        
        chart_elements = []
        for chart_b64 in charts:
            try:
                if chart_b64.startswith('data:image/png;base64,'):
                    chart_b64 = chart_b64.split(',')[1]
                
                img_data = base64.b64decode(chart_b64)
                
                # If there's only one chart, let it span the full width of the page
                if len(charts) == 1:
                    w = 10 * inch
                    h = 4.5 * inch
                else:
                    w = 4.2 * inch
                    h = 2.5 * inch
                    
                img = RLImage(io.BytesIO(img_data), width=w, height=h, kind='proportional')
                chart_elements.append(img)
            except Exception as e:
                print(f"Failed to embed chart: {e}")
        
        # Display up to 2 charts side by side
        if len(chart_elements) == 1:
            elements.append(KeepTogether([heading, chart_elements[0]]))
        elif len(chart_elements) >= 2:
            chart_table = Table([chart_elements[:2]], colWidths=[4.2*inch, 4.2*inch])
            chart_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
            
            keep_together_elements = [heading, chart_table]
            if len(chart_elements) == 3:
                keep_together_elements.append(Spacer(1, 0.2 * inch))
                keep_together_elements.append(chart_elements[2])
                
            elements.append(KeepTogether(keep_together_elements))

        elements.append(Spacer(1, 0.4 * inch))

    # 5. Data Table
    if rows:
        elements.append(Paragraph("<b>DATA ANALYSIS</b>", ParagraphStyle('DataHeading', fontSize=12, textColor=colors.HexColor('#3b82f6'), spaceAfter=8)))
        
        # Filter down columns to avoid squishing
        display_headers = [h for h in headers if h.lower() not in ['customer_id', 'id', 'cluster_id', '_id']]
        if len(display_headers) > 10:
            display_headers = display_headers[:10]
            
        header_style = ParagraphStyle('HeaderStyle', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=1)
        table_data = [[Paragraph(h.replace('_', ' ').title(), header_style) for h in display_headers]]
        for row in rows[:200]: # cap at 200 rows to ensure professional readable size
            table_data.append([_format_pdf_val(row.get(h, '')) for h in display_headers])
            
        col_width = (page_size[0] - 80) / len(display_headers)
        t = Table(table_data, colWidths=[col_width] * len(display_headers), repeatRows=1)
        
        # Professional alternating zebra stripes
        row_colors = [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')), # Slate 900 header
            ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
            ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0, 0), (-1, 0), 9),
            ('FONTSIZE',   (0, 1), (-1, -1), 8),
            ('ALIGN',      (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW',  (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]
        
        for i in range(1, len(table_data)):
            t_styles.append(('BACKGROUND', (0, i), (-1, i), row_colors[i % 2]))
            
        t.setStyle(TableStyle(t_styles))
        elements.append(t)

    # Footer hook
    def add_footer(canvas, document):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.drawString(40, 20, f"AI Retail Optimization Suite • Confidential Internal Document • Page {document.page}")
        canvas.restoreState()

    doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
    buffer.seek(0)
    return buffer.read()


# ══════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════

@report_bp.route('/export/<string:analysis_type>/<string:fmt>', methods=['POST'])
@handle_errors
def export_report(analysis_type, fmt):
    """
    Diagram 4.3.1.5 — Export Report flow:
    POST /api/reports/export/{churn|inventory|marketing|sales}/{csv|pdf}
    Body: { "dataset_id": "...", "data": [...], "summary": {...} }
    """
    if analysis_type not in ['churn', 'inventory', 'marketing', 'sales']:
        raise APIError(f"Unknown analysis type: {analysis_type}", 400)
    if fmt not in ['csv', 'pdf']:
        raise APIError("Format must be 'csv' or 'pdf'", 400)
    if fmt == 'pdf' and not PDF_AVAILABLE:
        raise APIError("PDF export not available. Run: pip install reportlab", 503)

    body = request.get_json()
    if not body or 'data' not in body:
        raise APIError("Request body must contain 'data' array", 400)

    data = body['data']
    dataset_id = body.get('dataset_id', 'unknown')
    summary = body.get('summary', {})
    charts = body.get('charts', [])
    
    title_map = {
        'churn':     'Churn_Analysis_Report',
        'inventory': 'Inventory_Forecast_Report',
        'marketing': 'Marketing_Insights_Report',
        'sales':     'Sales_Analysis_Report',
    }
    
    # Title for PDF Header (spaces instead of underscores)
    pdf_title = title_map[analysis_type].replace('_', ' ')
    
    # Title for filename (underscores)
    filename_title = title_map[analysis_type]
    date_str = datetime.now().strftime('%b_%d_%Y_%I_%M_%p')
    filename = f"{filename_title}_{date_str}"

    if not data:
        raise APIError("No data provided for export.", 400)

    headers = list(data[0].keys())

    # ── CSV
    if fmt == 'csv':
        csv_bytes = _generate_csv_bytes(headers, data)
        save_path = config.DATA_DIR / f"{filename}.csv"
        save_path.write_bytes(csv_bytes)
        db.mark_report_exported(dataset_id, analysis_type, str(save_path))
        return jsonify({'success': True, 'download_file': f"{filename}.csv"}), 200

    # ── PDF
    pdf_bytes = _generate_pdf_bytes(pdf_title, headers, data, summary, charts)
    save_path = config.DATA_DIR / f"{filename}.pdf"
    save_path.write_bytes(pdf_bytes)
    db.mark_report_exported(dataset_id, analysis_type, str(save_path))
    return jsonify({'success': True, 'download_file': f"{filename}.pdf"}), 200


@report_bp.route('/download/<string:filename>', methods=['GET'])
def download_report(filename):
    """Serve a saved report file for direct browser download."""
    import os
    safe_name = os.path.basename(filename)  # prevent path traversal
    file_path = config.DATA_DIR / safe_name
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    return send_file(
        str(file_path),
        as_attachment=True,
        download_name=safe_name
    )


@report_bp.route('/list', methods=['GET'])
@handle_errors
def list_reports():
    """List all generated reports."""
    dataset_id = request.args.get('dataset_id')
    reports = db.list_reports(dataset_id)
    return jsonify({'success': True, 'count': len(reports), 'reports': reports}), 200


@report_bp.route('/ml-history', methods=['GET'])
@handle_errors
def ml_history():
    """Get ML model training history."""
    dataset_id = request.args.get('dataset_id')
    history = db.get_ml_model_history(dataset_id)
    return jsonify({'success': True, 'history': history}), 200
