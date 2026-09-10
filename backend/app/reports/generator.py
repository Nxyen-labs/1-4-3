"""
WeasyPrint PDF report generator.
Renders HTML template with Jinja2 and converts to PDF.
Role-scoped: public reports exclude vessel/attribution data.
"""
from jinja2 import Template
from datetime import datetime


REPORT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0a1628; font-size: 11pt; line-height: 1.6; }
    .header { background: #0a1628; color: white; padding: 20px 30px; margin: -2cm -2cm 20px -2cm; }
    .header h1 { margin: 0; font-size: 22pt; font-weight: 600; }
    .header .subtitle { color: #a8c8e8; font-size: 10pt; margin-top: 5px; }
    .header .report-id { color: #d0e4f5; font-size: 9pt; float: right; margin-top: -30px; }
    .section { margin-bottom: 24px; page-break-inside: avoid; }
    .section h2 { color: #0a1628; font-size: 14pt; border-bottom: 2px solid #a8c8e8; padding-bottom: 6px; margin-bottom: 12px; }
    .section h3 { color: #1a3a5c; font-size: 12pt; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #d0e4f5; color: #0a1628; padding: 8px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #e8e8e8; }
    tr:nth-child(even) { background: #f5f8fc; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 600; }
    .badge-critical { background: #dc3545; color: white; }
    .badge-high { background: #fd7e14; color: white; }
    .badge-medium { background: #ffc107; color: #333; }
    .badge-low { background: #28a745; color: white; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 10px 0; }
    .metric-box { background: #f5f8fc; border: 1px solid #d0e4f5; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-box .value { font-size: 20pt; font-weight: 700; color: #0a1628; }
    .metric-box .label { font-size: 8pt; color: #666; text-transform: uppercase; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 10px 15px; border-radius: 6px; font-size: 9pt; margin: 10px 0; }
    .candidate-note { background: #d0e4f5; border-left: 4px solid #0a1628; padding: 10px 15px; margin: 10px 0; font-size: 9pt; }
    .score-bar { height: 8px; background: #e8e8e8; border-radius: 4px; overflow: hidden; margin: 4px 0; }
    .score-fill { height: 100%; border-radius: 4px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 8pt; color: #888; text-align: center; }
</style>
</head>
<body>

<div class="header">
    <h1>🛢️ Oil Spill Evidence Report</h1>
    <div class="subtitle">Oil Spill Detection & Vessel Attribution System — NTRO</div>
    <div class="report-id">Report: {{ spill.name }}<br>Generated: {{ generated_at }}</div>
</div>

<!-- Spill Summary -->
<div class="section">
    <h2>Spill Summary</h2>
    <div class="metric-grid">
        <div class="metric-box">
            <div class="value">{{ spill.area_sq_km or 'N/A' }}</div>
            <div class="label">Area (sq km)</div>
        </div>
        <div class="metric-box">
            <div class="value"><span class="badge badge-{{ spill.severity or 'low' }}">{{ (spill.severity or 'Unknown') | upper }}</span></div>
            <div class="label">Severity</div>
        </div>
        <div class="metric-box">
            <div class="value">{{ spill.validation_status | replace('_', ' ') | title }}</div>
            <div class="label">Status</div>
        </div>
    </div>
    <table>
        <tr><th>Property</th><th>Value</th></tr>
        <tr><td>Spill ID</td><td>{{ spill.name }}</td></tr>
        <tr><td>Detected At</td><td>{{ spill.detected_at }}</td></tr>
        <tr><td>Region</td><td>{{ spill.region or 'Unknown' }}</td></tr>
        <tr><td>Age Estimate</td><td>{{ spill.age_estimate or 'Unknown' }}</td></tr>
        <tr><td>Perimeter</td><td>{{ spill.perimeter_km or 'N/A' }} km</td></tr>
        <tr><td>Elongation Ratio</td><td>{{ spill.elongation_ratio or 'N/A' }}</td></tr>
        <tr><td>Fragmentation Index</td><td>{{ spill.fragmentation_index or 'N/A' }}</td></tr>
    </table>
</div>

<!-- Environmental Impact -->
{% if impact %}
<div class="section">
    <h2>Environmental Impact Assessment</h2>
    <div class="disclaimer">
        ⚠️ Values below are <strong>illustrative estimates</strong> based on available data. 
        They are not precise real-world figures and should not be used for legal or financial decisions.
    </div>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Affected Area</td><td>{{ impact.affected_area_sq_km or 'N/A' }} sq km</td></tr>
        <tr><td>Coast Proximity</td><td>{{ impact.coast_proximity_km or 'N/A' }} km</td></tr>
        <tr><td>MPA Overlap</td><td>{{ 'Yes' if impact.overlaps_mpa else 'No' }}</td></tr>
        <tr><td>Coral Reef Overlap</td><td>{{ 'Yes' if impact.overlaps_coral else 'No' }}</td></tr>
        <tr><td>EEZ Overlap</td><td>{{ 'Yes' if impact.overlaps_eez else 'No' }}</td></tr>
        <tr><td>Nearest MPA</td><td>{{ impact.nearest_mpa_name or 'N/A' }} ({{ impact.nearest_mpa_distance_km or 'N/A' }} km)</td></tr>
        <tr><td>Ecological Sensitivity</td><td>{{ impact.ecological_sensitivity_score or 'N/A' }}/100</td></tr>
        <tr><td>Response Priority</td><td><span class="badge badge-{{ impact.priority or 'low' }}">{{ (impact.priority or 'Unknown') | upper }}</span></td></tr>
        <tr><td>Est. Cleanup Cost (illustrative)</td><td>${{ '{:,.0f}'.format(impact.estimated_cleanup_cost_usd) if impact.estimated_cleanup_cost_usd else 'N/A' }}</td></tr>
    </table>
</div>
{% endif %}

<!-- Vessel Attribution (only for authenticated roles) -->
{% if suspects and show_attribution %}
<div class="section">
    <h2>Candidate Vessel Attribution</h2>
    <div class="candidate-note">
        <strong>Important:</strong> The vessels listed below are <em>candidates</em> ranked by attribution likelihood. 
        This is NOT a confirmed identification. Scores reflect statistical correlation with the spill origin, 
        not proof of responsibility. Further investigation is required.
    </div>
    <table>
        <tr>
            <th>Rank</th><th>Vessel</th><th>MMSI</th><th>Type</th>
            <th>Score</th><th>Confidence</th>
        </tr>
        {% for score, vessel in suspects %}
        <tr>
            <td><strong>#{{ score.rank }}</strong></td>
            <td>{{ vessel.vessel_name or 'Unknown' }}</td>
            <td>{{ vessel.mmsi }}</td>
            <td>{{ vessel.vessel_type or 'Unknown' }}</td>
            <td>{{ score.total_score }}/100</td>
            <td>{{ (score.confidence * 100) | round(0) }}%</td>
        </tr>
        {% endfor %}
    </table>

    {% if suspects %}
    <h3>Top Candidate — Score Breakdown</h3>
    {% set top = suspects[0] %}
    <table>
        <tr><th>Factor</th><th>Score</th><th>Weight</th></tr>
        <tr><td>Proximity to Origin</td><td>{{ top[0].proximity_score }}/100</td><td>25%</td></tr>
        <tr><td>Time Overlap</td><td>{{ top[0].time_overlap_score }}/100</td><td>20%</td></tr>
        <tr><td>AIS Signal Gap</td><td>{{ top[0].ais_gap_score }}/100</td><td>20%</td></tr>
        <tr><td>Speed Anomaly</td><td>{{ top[0].speed_anomaly_score }}/100</td><td>15%</td></tr>
        <tr><td>Course Anomaly</td><td>{{ top[0].course_anomaly_score }}/100</td><td>10%</td></tr>
        <tr><td>Route Deviation</td><td>{{ top[0].route_deviation_score }}/100</td><td>10%</td></tr>
    </table>
    {% endif %}
</div>
{% endif %}

<div class="footer">
    Oil Spill Detection & Vessel Attribution System — NTRO Hackathon | 
    Report generated {{ generated_at }} | Classification: {{ 'RESTRICTED' if show_attribution else 'PUBLIC' }}
</div>

</body>
</html>
"""


def render_report_html(spill, impact=None, suspects=None, user_role="public"):
    """Render the evidence report HTML with role-scoped content."""
    template = Template(REPORT_TEMPLATE)
    
    show_attribution = user_role in ("coast_guard", "regional_manager", "higher_authority")
    
    html = template.render(
        spill=spill,
        impact=impact,
        suspects=suspects or [],
        show_attribution=show_attribution,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    )
    return html


def html_to_pdf(html_string):
    """Convert HTML string to PDF bytes using WeasyPrint."""
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_string).write_pdf()
        return pdf_bytes
    except ImportError:
        # WeasyPrint not installed — return HTML as fallback
        return html_string.encode("utf-8")
    except Exception as e:
        # WeasyPrint rendering error — return HTML as fallback
        print(f"WeasyPrint error: {e}")
        return html_string.encode("utf-8")
