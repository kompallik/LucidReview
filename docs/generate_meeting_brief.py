"""
Generate the LucidReview Commercialization Meeting Brief PDF.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from datetime import date

# ── Color palette ──────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#0F2B5B")
TEAL      = colors.HexColor("#0D7B77")
TEAL_LIGHT= colors.HexColor("#E6F5F4")
SLATE     = colors.HexColor("#3A4B6B")
GOLD      = colors.HexColor("#D4A017")
LIGHT_GRAY= colors.HexColor("#F4F6FA")
MID_GRAY  = colors.HexColor("#8A99B3")
WHITE     = colors.white
BLACK     = colors.HexColor("#1A1A2E")

OUTPUT_PATH = "/Users/kkompalli/Prototypes/LucidReview/docs/LucidReview_Commercialization_Brief.pdf"

def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles['doc_title'] = ParagraphStyle(
        'doc_title', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=26, textColor=WHITE,
        leading=32, alignment=TA_LEFT, spaceAfter=4,
    )
    styles['doc_subtitle'] = ParagraphStyle(
        'doc_subtitle', parent=base['Normal'],
        fontName='Helvetica', fontSize=13, textColor=colors.HexColor("#B8C8E8"),
        leading=18, alignment=TA_LEFT, spaceAfter=0,
    )
    styles['section_num'] = ParagraphStyle(
        'section_num', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=9, textColor=TEAL,
        leading=12, alignment=TA_LEFT, spaceBefore=18, spaceAfter=2,
        leftIndent=0,
    )
    styles['h1'] = ParagraphStyle(
        'h1', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=17, textColor=NAVY,
        leading=22, spaceBefore=4, spaceAfter=8, borderPad=0,
    )
    styles['h2'] = ParagraphStyle(
        'h2', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=12, textColor=SLATE,
        leading=16, spaceBefore=14, spaceAfter=4,
    )
    styles['h3'] = ParagraphStyle(
        'h3', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=10, textColor=TEAL,
        leading=14, spaceBefore=10, spaceAfter=3,
    )
    styles['body'] = ParagraphStyle(
        'body', parent=base['Normal'],
        fontName='Helvetica', fontSize=9, textColor=BLACK,
        leading=14, spaceAfter=5,
    )
    styles['body_small'] = ParagraphStyle(
        'body_small', parent=base['Normal'],
        fontName='Helvetica', fontSize=8, textColor=BLACK,
        leading=12, spaceAfter=4,
    )
    styles['bullet'] = ParagraphStyle(
        'bullet', parent=base['Normal'],
        fontName='Helvetica', fontSize=9, textColor=BLACK,
        leading=13, leftIndent=14, spaceAfter=3,
        bulletIndent=4,
    )
    styles['bullet_bold'] = ParagraphStyle(
        'bullet_bold', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=9, textColor=NAVY,
        leading=13, leftIndent=14, spaceAfter=3,
        bulletIndent=4,
    )
    styles['callout'] = ParagraphStyle(
        'callout', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=10, textColor=NAVY,
        leading=15, leftIndent=12, rightIndent=12,
        spaceBefore=8, spaceAfter=8,
        backColor=TEAL_LIGHT, borderPad=8,
    )
    styles['caption'] = ParagraphStyle(
        'caption', parent=base['Normal'],
        fontName='Helvetica-Oblique', fontSize=7.5, textColor=MID_GRAY,
        leading=11, spaceAfter=4, alignment=TA_CENTER,
    )
    styles['footer'] = ParagraphStyle(
        'footer', parent=base['Normal'],
        fontName='Helvetica', fontSize=7, textColor=MID_GRAY,
        alignment=TA_CENTER,
    )
    styles['toc_entry'] = ParagraphStyle(
        'toc_entry', parent=base['Normal'],
        fontName='Helvetica', fontSize=10, textColor=SLATE,
        leading=16, leftIndent=20, spaceAfter=2,
    )
    styles['toc_num'] = ParagraphStyle(
        'toc_num', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=10, textColor=TEAL,
        leading=16, spaceAfter=2,
    )
    styles['highlight_num'] = ParagraphStyle(
        'highlight_num', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=22, textColor=TEAL,
        leading=26, alignment=TA_CENTER, spaceAfter=2,
    )
    styles['highlight_label'] = ParagraphStyle(
        'highlight_label', parent=base['Normal'],
        fontName='Helvetica', fontSize=8, textColor=SLATE,
        leading=11, alignment=TA_CENTER, spaceAfter=0,
    )

    return styles

def tbl(data, col_widths, style_cmds, row_heights=None):
    t = Table(data, colWidths=col_widths, rowHeights=row_heights)
    base = [
        ('FONTNAME',      (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE',      (0,0), (-1,-1), 8),
        ('TEXTCOLOR',     (0,0), (-1,-1), BLACK),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 7),
        ('RIGHTPADDING',  (0,0), (-1,-1), 7),
    ]
    t.setStyle(TableStyle(base + style_cmds))
    return t

def header_row_style(n_cols):
    return [
        ('BACKGROUND',  (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',   (0,0), (-1,0), WHITE),
        ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,0), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
        ('GRID',        (0,0), (-1,-1), 0.4, colors.HexColor("#D0D8E8")),
        ('LINEBELOW',   (0,0), (-1,0), 1, TEAL),
    ]

def divider(s):
    return HRFlowable(width="100%", thickness=1.2, color=TEAL, spaceAfter=8, spaceBefore=2)

def section_label(text, styles):
    return Paragraph(text.upper(), styles['section_num'])

def h1(text, styles):
    return Paragraph(text, styles['h1'])

def h2(text, styles):
    return Paragraph(text, styles['h2'])

def h3(text, styles):
    return Paragraph(text, styles['h3'])

def body(text, styles):
    return Paragraph(text, styles['body'])

def bullet(text, styles, bold=False):
    key = 'bullet_bold' if bold else 'bullet'
    return Paragraph(f"• {text}", styles[key])

def sp(n=6):
    return Spacer(1, n)

def callout(text, styles):
    return Paragraph(text, styles['callout'])

# ── Cover page ─────────────────────────────────────────────────────────────────
def cover_page(styles):
    elements = []

    # Navy banner
    banner_data = [[
        Paragraph("CONFIDENTIAL — MEETING BRIEF", ParagraphStyle(
            'banner', parent=styles['doc_subtitle'],
            fontSize=8, textColor=colors.HexColor("#7BAFD4"),
        ))
    ]]
    banner = tbl(banner_data, [7*inch], [
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ])
    elements.append(banner)
    elements.append(sp(28))

    # Teal accent line
    elements.append(HRFlowable(width="100%", thickness=4, color=TEAL, spaceAfter=20))

    elements.append(Paragraph("LucidReview", ParagraphStyle(
        'main_title', parent=styles['doc_title'],
        fontSize=36, textColor=NAVY, spaceAfter=6,
    )))
    elements.append(Paragraph(
        "Commercialization &amp; Execution Plan",
        ParagraphStyle('sub1', parent=styles['h1'], fontSize=20, textColor=SLATE, spaceAfter=4)
    ))
    elements.append(Paragraph(
        "Automating Utilization Management for Medicare &amp; Medicaid Health Plans",
        ParagraphStyle('sub2', parent=styles['body'], fontSize=12, textColor=TEAL, spaceAfter=24)
    ))

    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#C0CCE0"), spaceAfter=24))

    # Key stats row
    stat_data = [[
        Paragraph("9,974", styles['highlight_num']),
        Paragraph("82.7%", styles['highlight_num']),
        Paragraph("$80–225M", styles['highlight_num']),
        Paragraph("2027", styles['highlight_num']),
    ],[
        Paragraph("Real SCAN cases\nanalyzed", styles['highlight_label']),
        Paragraph("Cases with\ndocumentation gaps", styles['highlight_label']),
        Paragraph("Total Addressable\nMarket (ARR)", styles['highlight_label']),
        Paragraph("CMS-0057-F FHIR\nPA API mandate", styles['highlight_label']),
    ]]
    stat_tbl = tbl(stat_data, [1.75*inch]*4, [
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_GRAY),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_GRAY]),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#C0CCE0")),
        ('LINEAFTER', (0,0), (2,1), 0.5, colors.HexColor("#C0CCE0")),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    elements.append(stat_tbl)
    elements.append(sp(28))

    # Table of contents
    elements.append(Paragraph("CONTENTS", ParagraphStyle(
        'toc_head', parent=styles['h3'], fontSize=9, textColor=MID_GRAY,
        spaceAfter=8, spaceBefore=0,
    )))
    toc_items = [
        ("01", "Market Opportunity Summary"),
        ("02", "Competitive Landscape"),
        ("03", "Pricing Model Mechanics"),
        ("04", "Criteria Library Build-Out"),
        ("05", "Meeting Agenda Guide"),
    ]
    for num, title in toc_items:
        row = [[
            Paragraph(num, ParagraphStyle('n', parent=styles['body'],
                fontName='Helvetica-Bold', fontSize=10, textColor=TEAL)),
            Paragraph(title, ParagraphStyle('t', parent=styles['body'],
                fontSize=10, textColor=NAVY)),
        ]]
        t = tbl(row, [0.45*inch, 6.5*inch], [
            ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor("#D8E0EE")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ])
        elements.append(t)

    elements.append(sp(30))
    elements.append(Paragraph(
        f"Prepared: {date.today().strftime('%B %d, %Y')}  ·  Internal Use Only  ·  LucidReview",
        styles['caption']
    ))
    elements.append(PageBreak())
    return elements

# ── Section 01 — Market Opportunity ───────────────────────────────────────────
def section_01(styles):
    el = []
    el.append(section_label("01 / Market Opportunity", styles))
    el.append(h1("One-Page Market Opportunity Summary", styles))
    el.append(divider(styles))
    el.append(sp(4))

    el.append(h2("The Problem We're Solving", styles))
    el.append(body(
        "Prior authorization is the most labor-intensive, error-prone, and legally exposed process "
        "in health plan operations. It sits at the intersection of clinical complexity, regulatory "
        "mandate, and operational cost — with no scalable solution purpose-built for the "
        "Medicare/Medicaid market.",
        styles
    ))
    el.append(sp(4))

    prob_data = [
        ["Metric", "Data Point", "Source"],
        ["Cases with documentation gaps (pre-reviewer)", "82.7%", "9,974 SCAN cases"],
        ["Current cost per case (clinical labor)", "$15 – $25", "RN + MD blended rate"],
        ["AI-detectable denials before MD review", "~40% of all denials", "10K case analysis"],
        ["Most common denial reason", "Does not meet criteria (20.5%)", "10K case analysis"],
        ["CMS-0057-F FHIR PA API deadline", "January 2027", "CMS Final Rule"],
        ["MCG/InterQual licensing cost (large plan)", "$500K – $1M+/year", "Market data"],
    ]
    el.append(tbl(prob_data, [2.6*inch, 2.3*inch, 2*inch],
        header_row_style(3)
    ))
    el.append(sp(14))

    el.append(callout(
        "⚑  For Medicare Advantage, CMS requires decisions to align with Traditional Medicare "
        "criteria (NCDs/LCDs). MCG/InterQual are permitted only in gaps — making CMS public "
        "criteria the legally correct foundation for this market.",
        styles
    ))
    el.append(sp(10))

    el.append(h2("Case Volume Distribution (9,974 Real Cases)", styles))
    el.append(body(
        "Data from SCAN Health Plan — a Medicare Advantage plan — provides empirical grounding "
        "for implementation priorities:",
        styles
    ))
    vol_data = [
        ["Service Line", "Volume", "Approval Rate", "AI Automation Potential"],
        ["Out of Area (OOA)", "48.1%", "38.9%", "High — date logic, urgency rules"],
        ["Inpatient Level of Care", "22.5%", "29.8%", "Medium — clinical criteria depth"],
        ["NFDS (Diabetic Supplies)", "8.3%", "11.5%", "Very High — single criteria check"],
        ["Preservice Outpatient", "5.8%", "86.3%", "High — strong auto-approve path"],
        ["Nutritional Supplements", "4.6%", "63.5%", "Medium — BMI/Rx check"],
        ["Transplant", "4.6%", "73.6%", "Medium — workup checklist"],
        ["DME", "3.0%", "36.9%", "Medium — LCD criteria lookup"],
    ]
    el.append(tbl(vol_data, [2.1*inch, 0.85*inch, 1.0*inch, 2.95*inch],
        header_row_style(4)
    ))
    el.append(sp(14))

    el.append(h2("Target Market & TAM", styles))
    tam_data = [
        ["Segment", "Organizations", "PMPM Range", "Est. ARR/Customer", "Segment TAM"],
        ["Medicare Advantage", "~250 orgs", "$0.75–$1.50", "$150K – $2M", "$40–100M"],
        ["Medicaid MCOs", "~200 orgs", "$0.75–$1.25", "$100K – $1M", "$25–75M"],
        ["Dual-Eligible (D-SNPs)", "~150 plans", "$1.00–$1.75", "$200K – $1.5M", "$15–50M"],
        ["Total TAM", "", "", "", "$80–225M ARR"],
    ]
    el.append(tbl(tam_data, [1.7*inch, 1.15*inch, 1.0*inch, 1.3*inch, 1.75*inch],
        header_row_style(5) + [
            ('FONTNAME', (0,4), (-1,4), 'Helvetica-Bold'),
            ('BACKGROUND', (0,4), (-1,4), TEAL_LIGHT),
            ('TEXTCOLOR', (0,4), (-1,4), NAVY),
        ]
    ))
    el.append(sp(6))
    el.append(Paragraph(
        "SOM Years 1–3: 5–15 customers = $2–15M ARR",
        ParagraphStyle('som', parent=styles['body'], fontName='Helvetica-Bold',
                       textColor=TEAL, fontSize=9)
    ))
    el.append(sp(14))

    el.append(h2("Business Case for a Health Plan", styles))
    roi_data = [
        ["Metric", "Current State", "With LucidReview", "Impact"],
        ["Time per case", "~15 min", "3–8 min", "50–80% reduction"],
        ["Doc gap detection", "After MD review", "Before MD review", "Eliminates wasted escalations"],
        ["Auto-triage (clear cases)", "0%", "~45% of volume", "New capacity"],
        ["AI-flaggable denials (pre-MD)", "0%", "~40% of denials", "Major MD time savings"],
        ["CMS-0057-F readiness", "Behind", "Day-one compliant", "Avoids regulatory risk"],
        ["100K-member plan monthly savings", "—", "$45–85K/month", "$540K–$1M/year"],
    ]
    el.append(tbl(roi_data, [2.0*inch, 1.4*inch, 1.5*inch, 2.0*inch],
        header_row_style(4) + [
            ('FONTNAME', (0,6), (-1,6), 'Helvetica-Bold'),
            ('BACKGROUND', (0,6), (-1,6), TEAL_LIGHT),
        ]
    ))
    el.append(PageBreak())
    return el

# ── Section 02 — Competitive Landscape ────────────────────────────────────────
def section_02(styles):
    el = []
    el.append(section_label("02 / Competitive Landscape", styles))
    el.append(h1("Competitive Landscape", styles))
    el.append(divider(styles))
    el.append(sp(4))

    el.append(h2("Positioning Map", styles))
    el.append(body(
        "No current competitor occupies the high-clinical-depth + AI-native + CMS-standards-based "
        "quadrant for the Medicare/Medicaid market. LucidReview's differentiated position:",
        styles
    ))
    el.append(sp(4))

    pos_data = [
        ["", "Rules-Based / Workflow", "AI-Native"],
        ["High Clinical Depth",
         "MCG / InterQual\n(passive reference, licensed criteria,\nnot FHIR-native, expensive)",
         "LucidReview ✓\n(active CQL evaluation, CMS-grounded,\nfull audit trail, FHIR/Da Vinci)"],
        ["Low Clinical Depth",
         "Legacy UM Systems\n(Jiva, Macess — workflow routing,\nno criteria evaluation)",
         "Cohere Health\n(AI, but narrow specialty\nservice lines, commercial payer focus)"],
    ]
    el.append(tbl(pos_data, [1.5*inch, 2.7*inch, 2.7*inch], [
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR',  (0,0), (-1,0), WHITE),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND', (0,1), (0,2), SLATE),
        ('TEXTCOLOR',  (0,1), (0,2), WHITE),
        ('FONTNAME',   (0,1), (0,2), 'Helvetica-Bold'),
        ('BACKGROUND', (2,1), (2,1), TEAL_LIGHT),
        ('FONTNAME',   (2,1), (2,1), 'Helvetica-Bold'),
        ('TEXTCOLOR',  (2,1), (2,1), NAVY),
        ('BACKGROUND', (1,1), (1,2), LIGHT_GRAY),
        ('BACKGROUND', (2,2), (2,2), LIGHT_GRAY),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.HexColor("#C0CCE0")),
        ('VALIGN',     (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',      (0,0), (0,-1), 'CENTER'),
        ('ROWHEIGHTS', (0,0), (-1,-1), None),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    el.append(sp(14))

    el.append(h2("Competitor Analysis", styles))
    comp_data = [
        ["Competitor", "What They Do", "Key Weakness vs. LucidReview"],
        ["Cohere Health\n($150M raised)",
         "AI-powered PA for specialty service lines (MSK, cardiology, oncology)",
         "Service-line specific — does not cover OOA, Inpatient LOC, NFDS (majority of MA/Medicaid volume). Commercial payer focus."],
        ["Waystar",
         "Revenue cycle automation, PA workflow management",
         "Workflow routing only — no clinical criteria evaluation. Not AI-native for medical necessity."],
        ["MCG Health\n(Hearst)",
         "Evidence-based criteria licensed to plans for UM decision support",
         "Passive reference tool — criteria looked up manually, not applied automatically. Not FHIR-native. $500K–2M/year. For MA, plans must justify use over CMS criteria."],
        ["InterQual\n(Optum)",
         "Clinical criteria licensed to plans, widely used for inpatient LOC",
         "Same passive reference limitations as MCG. Change Healthcare ransomware incident raised serious operational reliability concerns."],
        ["EviCore\n(Evernorth/Cigna)",
         "Specialty PA management, internally built for Cigna + delegated services",
         "Captive to Cigna ecosystem. Not sold as external platform. Proprietary criteria. Not FHIR-native."],
        ["Availity",
         "Payer-provider connectivity, some PA automation",
         "Infrastructure layer — no clinical decision engine, no AI evaluation of medical necessity."],
    ]
    el.append(tbl(comp_data, [1.4*inch, 2.0*inch, 3.5*inch],
        header_row_style(3) + [
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ]
    ))
    el.append(sp(14))

    el.append(h2("Why We Win — The 5 Differentiators", styles))
    diff = [
        ("1. Regulatory alignment", "Built on CMS NCD/LCD public criteria — the legally required basis for MA/Medicaid. MCG/InterQual are permitted only in gaps, and must be publicly accessible even then."),
        ("2. Full FHIR + Da Vinci compliance", "CMS-0057-F requires FHIR PA APIs by 2027. PAS, CRD, and DTR endpoints are already implemented. We're ahead of the mandate."),
        ("3. Transparent AI with full audit trail", "Every determination traces to a FHIR resource, document offset, and CMS policy citation. Not a black box — essential for appeals and regulatory review."),
        ("4. No MCG/InterQual licensing cost", "Eliminates $500K–2M/year licensing from the plan's cost structure and from our COGS. Higher margins, simpler sales."),
        ("5. AI criteria synthesis", "Claude synthesizes multiple regional LCD variants into one authoritative criteria tree automatically — a capability no competitor offers."),
    ]
    for title, desc in diff:
        row = [[
            Paragraph(title, ParagraphStyle('dt', parent=styles['body'],
                fontName='Helvetica-Bold', textColor=TEAL, fontSize=9)),
            Paragraph(desc, styles['body_small']),
        ]]
        t = tbl(row, [1.8*inch, 5.1*inch], [
            ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor("#D8E0EE")),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ])
        el.append(t)

    el.append(sp(10))
    el.append(h2("The Target Customer (Build vs. Buy)", styles))
    el.append(body(
        "Large health plans (UnitedHealth, Anthem, Humana) will build internally. "
        "The right buyers are:",
        styles
    ))
    for b in [
        "Mid-size MA plans (50K–500K members) — no engineering capacity, need cost efficiency",
        "Regional Medicaid MCOs — state contracts, thin margins, under CMS-0057-F pressure",
        "Dual-Eligible Special Needs Plans (D-SNPs) — growing segment, most complex criteria environment, underserved",
        "Specialty MA plans — condition-specific populations, high clinical complexity per member",
    ]:
        el.append(bullet(b, styles))

    el.append(PageBreak())
    return el

# ── Section 03 — Pricing Model ────────────────────────────────────────────────
def section_03(styles):
    el = []
    el.append(section_label("03 / Pricing Model", styles))
    el.append(h1("Pricing Model Mechanics", styles))
    el.append(divider(styles))
    el.append(sp(4))

    el.append(h2("Recommended Model: Tiered PMPM Subscription + Implementation Fee", styles))
    el.append(body(
        "PMPM pricing matches how health plans budget for everything. "
        "It scales with the plan, aligns incentives (we succeed when they grow), "
        "and provides predictable ARR for financial planning.",
        styles
    ))
    el.append(sp(8))

    el.append(h3("PMPM Subscription Tiers", styles))
    pmpm_data = [
        ["Tier", "Members", "PMPM", "Monthly Revenue", "Annual Revenue", "Key Addition"],
        ["Starter", "Up to 50K", "$1.50", "$75K", "$900K",
         "Core AI review, NCD/LCD library, Reviewer UI, PAS API, 1 UM integration"],
        ["Growth", "50K–200K", "$1.25", "$63K–250K", "$750K–3M",
         "+ CRD/DTR endpoints, criteria authoring portal, CMS-0057-F reporting, 2 UM integrations"],
        ["Scale", "200K–500K", "$1.00", "$200K–500K", "$2.4M–6M",
         "+ AI criteria synthesis, shadow mode analytics, custom NLP tuning, 3 integrations, SLA"],
        ["Enterprise", "500K+", "$0.75+", "$375K+", "$4.5M+",
         "+ Private VPC option, unlimited integrations, joint criteria governance, model fine-tuning"],
    ]
    el.append(tbl(pmpm_data, [0.7*inch, 0.8*inch, 0.6*inch, 1.1*inch, 1.0*inch, 2.7*inch],
        header_row_style(6) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
        ]
    ))
    el.append(sp(12))

    el.append(h3("One-Time Implementation Fee", styles))
    impl_data = [
        ["Component", "Cost", "Notes"],
        ["UM system integration (per system)", "$25K–$75K", "Jiva, Macess, Essette, etc. — ~4–8 weeks per adapter"],
        ["Criteria configuration (initial library)", "$15K–$40K", "CQL authoring for plan's specific service mix"],
        ["Security review + HIPAA assessment", "$10K–$20K", "One-time, reusable for renewals"],
        ["Staff training + go-live support", "$10K–$25K", "Nurse/MD reviewer onboarding"],
        ["Total implementation", "$60K–$160K", "Per customer"],
    ]
    el.append(tbl(impl_data, [2.5*inch, 1.3*inch, 3.1*inch],
        header_row_style(3) + [
            ('FONTNAME', (0,5), (-1,5), 'Helvetica-Bold'),
            ('BACKGROUND', (0,5), (-1,5), TEAL_LIGHT),
        ]
    ))
    el.append(sp(12))

    el.append(h3("Alternative: Per-Case Pricing (for Pilots)", styles))
    case_data = [
        ["Volume Tier", "Price/Case", "Current Cost/Case", "Customer Savings"],
        ["< 1,000 cases/month (Pilot)", "$8.00", "$15–$25", "40–68%"],
        ["1,000–5,000/month", "$6.00", "$15–$25", "60–76%"],
        ["5,000–15,000/month", "$4.50", "$15–$25", "70–82%"],
        ["15,000+/month (Enterprise)", "$3.00", "$15–$25", "80–88%"],
    ]
    el.append(tbl(case_data, [2.1*inch, 1.1*inch, 1.5*inch, 2.2*inch],
        header_row_style(4)
    ))
    el.append(sp(12))

    el.append(h2("The Pilot-to-Production Funnel", styles))
    el.append(body(
        "Health plan sales cycles are 12–18 months. "
        "A structured pilot de-risks the sale for the buyer and generates the concordance "
        "data needed for subsequent sales:",
        styles
    ))
    pilot_data = [
        ["Phase", "Duration", "What Happens", "Success Metric"],
        ["1. Shadow Mode", "60–90 days", "AI runs in parallel, no production decisions. Plan sees AI recommendations alongside human decisions.", "Concordance rate with human reviewer ≥ 85%"],
        ["2. Assisted Review", "Months 4–6", "AI proposes, human approves everything. Measure time-per-case reduction.", "≥ 40% time savings vs. baseline"],
        ["3. Production", "Month 7+", "Clear cases auto-approved per plan's thresholds. Full PMPM contract activates.", "PMPM subscription signed"],
    ]
    el.append(tbl(pilot_data, [1.1*inch, 0.9*inch, 2.6*inch, 2.3*inch],
        header_row_style(4) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ]
    ))
    el.append(sp(12))

    el.append(h2("Unit Economics at Scale", styles))
    econ_data = [
        ["Scenario", "Customers", "Avg Members", "PMPM", "ARR", "Criteria Team Cost", "Gross Margin Est."],
        ["Year 1 (Launch)", "3", "100K", "$1.25", "$4.5M", "$260K", "~75%"],
        ["Year 2 (Growth)", "8", "150K", "$1.15", "$16.6M", "$350K", "~80%"],
        ["Year 3 (Scale)", "15", "200K", "$1.00", "$36M", "$500K", "~82%"],
    ]
    el.append(tbl(econ_data, [1.1*inch, 0.85*inch, 0.85*inch, 0.65*inch, 0.8*inch, 1.3*inch, 1.35*inch],
        header_row_style(7) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ]
    ))
    el.append(sp(6))
    el.append(body(
        "Criteria team cost is shared across all customers — the primary moat asset amortizes "
        "at scale while margins expand.",
        styles
    ))

    el.append(PageBreak())
    return el

# ── Section 04 — Criteria Library Build-Out ───────────────────────────────────
def section_04(styles):
    el = []
    el.append(section_label("04 / Criteria Library", styles))
    el.append(h1("Criteria Library Build-Out", styles))
    el.append(divider(styles))
    el.append(sp(4))

    el.append(callout(
        "The criteria library is the product's clinical intelligence — and the primary "
        "defensible moat. The technology plumbing is built. The clinical content is the work.",
        styles
    ))
    el.append(sp(10))

    el.append(h2("What's Already Built (Prototype)", styles))
    built_data = [
        ["Component", "Status", "Notes"],
        ["CMS NCD/LCD ingestion pipeline", "✅ Live", "Fetches all NCDs + LCDs from CMS Coverage API, auto-updates on delta"],
        ["ICD-10 + HCPCS code enrichment", "✅ Live", "Pulls covered/non-covered codes per policy from CMS Articles"],
        ["Policy storage + versioning", "✅ Live", "MySQL, with ACTIVE/RETIRED status tracking"],
        ["CQL evaluation engine", "✅ Live", "HAPI FHIR Clinical Reasoning — ARF demo works end-to-end"],
        ["AI criteria synthesis", "✅ Live", "Claude synthesizes multiple regional LCD variants into one authoritative tree"],
        ["Criteria DSL → decision tree", "✅ Live", "DSL stored as JSON tree, rendered in Reviewer UI with evidence links"],
        ["DTR Questionnaire service", "✅ Live", "Returns FHIR Questionnaire for documentation gap collection"],
        ["CRD coverage discovery", "✅ Live", "CDS Hooks response with policy links at point-of-care"],
        ["Da Vinci PAS endpoint", "✅ Live", "Accepts FHIR Claim bundle, returns ClaimResponse — CMS-0057-F ready"],
        ["CQL content — OOA, Inpatient, NFDS...", "⚠️ Needed", "Service line criteria authored as CQL — primary build work"],
    ]
    el.append(tbl(built_data, [2.4*inch, 0.9*inch, 3.6*inch],
        header_row_style(3) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ('BACKGROUND', (0,10), (-1,10), colors.HexColor("#FFF8E6")),
            ('TEXTCOLOR', (1,10), (1,10), colors.HexColor("#B87000")),
        ]
    ))
    el.append(sp(14))

    el.append(h2("Service Line Prioritization & Build Effort", styles))
    sl_data = [
        ["Priority", "Service Line", "Volume", "Complexity", "CQL Effort", "Who Authors"],
        ["1", "OOA Urgency / Foreseen Need", "48.1%", "Low", "2–3 weeks", "Informaticist"],
        ["2", "NFDS (Diabetic Supplies)", "8.3%", "Very Low", "1 week", "RN + Informaticist"],
        ["3", "Preservice Outpatient", "5.8%", "Low", "1–2 weeks", "Informaticist"],
        ["4", "Nutritional Supplements", "4.6%", "Low", "1–2 weeks", "Informaticist"],
        ["5", "Inpatient Level of Care", "22.5%", "High", "6–10 weeks", "MD + Informaticist"],
        ["6", "Transplant", "4.6%", "Medium", "3–4 weeks", "MD + Informaticist"],
        ["7", "DME", "3.0%", "Medium", "4–6 weeks", "Informaticist"],
        ["8", "Pharmacy / Formulary Exceptions", "0.9%", "Medium", "3–4 weeks", "Pharmacist + Informaticist"],
    ]
    el.append(tbl(sl_data, [0.55*inch, 1.8*inch, 0.65*inch, 0.75*inch, 0.9*inch, 2.2*inch],
        header_row_style(6) + [
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
            ('BACKGROUND', (0,5), (-1,5), colors.HexColor("#FFF8E6")),
        ]
    ))
    el.append(sp(6))
    el.append(body(
        "Phase 1 (OOA + NFDS + Preservice): covers 62% of case volume in ~6–8 weeks "
        "with 2 clinical FTEs. Phase 2 adds Inpatient LOC + Transplant to reach 90% coverage.",
        styles
    ))
    el.append(sp(14))

    el.append(h2("The AI-Assisted Criteria Authoring Workflow", styles))
    el.append(body(
        "The same AI that reviews cases also drafts criteria — dramatically reducing the clinical "
        "team's authoring burden. This is not theoretical; the prompt pipeline and criteria DSL "
        "infrastructure are already in the codebase.",
        styles
    ))
    el.append(sp(4))
    steps = [
        ("CMS auto-ingests policy", "policy_ingestion.service.ts fetches NCD/LCD updates automatically via delta sync"),
        ("AI drafts criteria predicates", "Claude extracts atomic boolean criteria from policy text → CQL + DSL JSON (30–60 min clinical review vs. 8–16 hrs cold authoring)"),
        ("CQL compiled + unit tested", "Each criterion gets 3 test cases: should-approve, should-deny, unknown/more-info"),
        ("Medical Director reviews + signs off", "Criteria published with MD approval documented and version-controlled"),
        ("Deployed to criteria library", "Versioned, auditable, linked to CMS source document. Applied to all future cases."),
    ]
    for i, (title, desc) in enumerate(steps, 1):
        row = [[
            Paragraph(str(i), ParagraphStyle('stepn', parent=styles['body'],
                fontName='Helvetica-Bold', textColor=WHITE, fontSize=10,
                alignment=TA_CENTER)),
            Paragraph(f"<b>{title}</b><br/><font size='8'>{desc}</font>",
                ParagraphStyle('stepd', parent=styles['body'], fontSize=8, leading=12)),
        ]]
        t = tbl(row, [0.35*inch, 6.5*inch], [
            ('BACKGROUND', (0,0), (0,0), TEAL),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor("#D8E0EE")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ])
        el.append(t)
    el.append(sp(14))

    el.append(h2("The Clinical Team Model", styles))
    team_data = [
        ["Role", "FTE", "Responsibility", "Annual Cost"],
        ["Clinical Informaticist (RN or PA)", "1.5", "CQL authoring, criteria maintenance, policy monitoring", "$120K–$160K"],
        ["Medical Director (contract)", "0.25", "Clinical approval of all criteria, edge case escalation", "$75K–$100K"],
        ["Clinical Pharmacist (contract)", "0.10", "Pharmacy + formulary exception criteria", "$25K–$35K"],
        ["Total", "~1.85 FTE", "Full criteria library maintenance", "~$220K–$295K/year"],
    ]
    el.append(tbl(team_data, [2.1*inch, 0.55*inch, 2.8*inch, 1.45*inch],
        header_row_style(4) + [
            ('FONTNAME', (0,4), (-1,4), 'Helvetica-Bold'),
            ('BACKGROUND', (0,4), (-1,4), TEAL_LIGHT),
        ]
    ))
    el.append(sp(6))
    el.append(body(
        "This team maintains the criteria library for ALL customers. At 5 customers: ~$50K/customer/year. "
        "At 15 customers: ~$18K/customer/year. The moat compounds; the cost amortizes.",
        styles
    ))
    el.append(sp(14))

    el.append(h2("Criteria Maintenance Obligation", styles))
    maint_data = [
        ["Change Type", "Frequency", "Response Time", "Owner"],
        ["LCD retired / replaced", "5–10/month", "Within 2 weeks", "Informaticist (auto-flagged by ingestion pipeline)"],
        ["LCD criteria text updated", "20–30/month", "Within 4 weeks", "Informaticist + AI draft"],
        ["New NCD published", "2–4/year", "Within 4 weeks", "MD + Informaticist"],
        ["State Medicaid criteria change", "Quarterly per state", "Varies", "Informaticist per state"],
    ]
    el.append(tbl(maint_data, [1.7*inch, 1.1*inch, 1.2*inch, 2.9*inch],
        header_row_style(4) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ]
    ))
    el.append(sp(6))
    el.append(body(
        "The delta sync pipeline (enrichChangedPolicies) already detects when CMS updates a policy "
        "and queues it for re-enrichment. The human review step is the workflow to build around it.",
        styles
    ))
    el.append(sp(14))

    el.append(h2("Criteria Library Roadmap", styles))
    road_data = [
        ["Phase", "Timeline", "Service Lines", "Case Coverage", "Team"],
        ["0 — Foundation", "Weeks 1–8", "OOA + NFDS + Preservice Outpatient", "~62%", "1 Informaticist"],
        ["1 — Core", "Weeks 9–22", "+ Inpatient LOC + Transplant + Nutritional", "~90%", "1 MD + 1 Informaticist"],
        ["2 — Expand", "Weeks 23–30", "+ DME + Pharmacy + remaining categories", "~95%", "1 Informaticist"],
        ["3 — Medicaid", "Weeks 31–40", "State Medicaid (CA Medi-Cal first)", "Medicaid-specific", "1 Informaticist"],
        ["Ongoing Maintenance", "Continuous", "All service lines", "100%", "1.85 FTE steady-state"],
    ]
    el.append(tbl(road_data, [1.1*inch, 0.95*inch, 2.2*inch, 1.05*inch, 1.6*inch],
        header_row_style(5) + [
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
            ('FONTNAME', (0,5), (-1,5), 'Helvetica-Bold'),
            ('BACKGROUND', (0,5), (-1,5), TEAL_LIGHT),
        ]
    ))

    el.append(PageBreak())
    return el

# ── Section 05 — Meeting Agenda Guide ─────────────────────────────────────────
def section_05(styles):
    el = []
    el.append(section_label("05 / Meeting Agenda Guide", styles))
    el.append(h1("Meeting Agenda: Key Points by Hour", styles))
    el.append(divider(styles))
    el.append(sp(4))

    agenda_blocks = [
        {
            "label": "Hour 1",
            "title": "AI Research — Key Considerations",
            "who": "Herbelin, Maurice / Graham, Annette",
            "color": NAVY,
            "points": [
                ("Architecture principle", "AI for UM must be the orchestration and synthesis layer — not the decision layer. LucidReview is designed this way: CQL rules evaluate criteria, LLM summarizes and explains."),
                ("Hallucination mitigation", "Every LLM claim must have a FHIR citation or it is rejected by the system. This is already enforced in the agent's system prompt."),
                ("CMS compliance reality", "CMS MA guidance explicitly prohibits algorithm-only denials. Decisions must be individualized. The prototype preserves human sign-off on all determinations."),
                ("Highest-value AI intervention", "Detecting documentation gaps before the case reaches an MD (82.7% of cases). This is where AI creates the most immediate ROI."),
                ("Standards that matter", "FHIR R4, CQL, Da Vinci PAS/CRD/DTR — all implemented. These are not aspirational; they're in the codebase and CMS-0057-F mandates them."),
            ]
        },
        {
            "label": "Hours 2–4",
            "title": "Deep Dive: What AI Needs to Solve",
            "who": "Full Team",
            "color": TEAL,
            "points": [
                ("What works today", "End-to-end flow for Acute Respiratory Failure (inpatient). All 14 MCP tools functional. FHIR normalization, CQL evaluation, Reviewer UI — demonstrated live."),
                ("The primary gap", "Criteria library depth. The platform exists. CQL content for each service line is the work. OOA + NFDS + Preservice = 62% of volume in ~8 weeks."),
                ("What cannot be skipped", "Inpatient LOC (22.5% of volume, 70.2% denial rate) requires the deepest clinical criteria work — this is where MCG/InterQual have traditionally been used. Our answer is CMS LCDs + clinical team."),
                ("UM system adapter", "Every customer has a different system (Jiva, Macess, Essette). The FHIR normalization layer handles this — each adapter is ~4–8 weeks of integration work."),
                ("Production hardening", "HAPI FHIR (JVM, ~500MB, ~90s startup), Redis queue, observability — all need production hardening before a live customer. Estimate 3–4 months."),
                ("HIPAA/BAA", "Running on AWS Bedrock = HIPAA-eligible. No separate Anthropic relationship needed. This is a design choice, not an afterthought."),
            ]
        },
        {
            "label": "Hours 5–6",
            "title": "Story, Demo & Pricing",
            "who": "Helton, Carol / Jones, Megan",
            "color": SLATE,
            "points": [
                ("The narrative", "A nurse opens 30 prior auth cases. Without AI: 15 min each, 82% missing docs to chase. With LucidReview: AI pre-read the case, flagged gaps, evaluated criteria, wrote the summary. She reviews in 3 min and approves. 30 cases becomes 90 — or she goes home on time."),
                ("Demo flow", "Open Review Queue → select ARF-2026-001 → click 'Run AI Review' → watch live agent trace → show criteria checklist (all MET) → evidence citations → click Approve. The agent trace panel is the best demo asset."),
                ("Buyer persona", "VP/SVP Clinical Operations or Chief Medical Officer. Pain: reviewer burnout, CMS-0057-F compliance deadline, MCG/InterQual cost. Budget: operations, not IT."),
                ("Pricing anchor", "$15–25/case today → $3–8/case with AI = 60–80% cost reduction. 100K-member plan: $540K–$1M/year in savings. PMPM subscription is $150–200K/year."),
                ("Objection: black box AI", "The agent trace panel shows every step. Every determination cites a FHIR resource and CMS policy. This is the most auditable UM review system that exists."),
                ("Objection: regulatory risk", "Built to CMS-0057-F from day one. PAS/CRD/DTR already implemented. AI proposes; human approves. More defensible than MCG/InterQual for MA/Medicaid."),
            ]
        },
        {
            "label": "Final Hour",
            "title": "Execution Plan Alignment",
            "who": "Full Team",
            "color": GOLD,
            "points": [
                ("First customer profile", "Mid-size MA plan, 75K–200K members, California or Southwest (Medi-Cal overlap maximizes criteria reuse), existing SCAN relationship is the warm intro."),
                ("Land and expand", "Start with OOA — highest volume, algorithmic criteria, fastest to deploy. Prove ROI in shadow mode. Expand to Inpatient LOC in month 4."),
                ("Sales cycle reality", "12–18 months for health plan enterprise sales. Pipeline needs to start now. Pilot structure (shadow mode, no production risk) shortens evaluation cycle."),
                ("Year 1 investment", "~$400–600K one-time (platform hardening + first integration) + ~$500–760K/year operating (clinical team + sales). Break-even at 3–4 mid-size customers."),
                ("SCAN data is your asset", "9,974 real cases analyzed. Use this as 'we've validated on real production data' — not a proof-of-concept on synthetic data."),
                ("Not on the agenda today", "SmartProminence as solution factory — separate conversation. Today is LucidReview UM automation only."),
            ]
        },
    ]

    for block in agenda_blocks:
        # Header bar
        header_data = [[
            Paragraph(block["label"], ParagraphStyle('albl', parent=styles['body'],
                fontName='Helvetica-Bold', fontSize=9, textColor=WHITE)),
            Paragraph(block["title"], ParagraphStyle('atitle', parent=styles['body'],
                fontName='Helvetica-Bold', fontSize=11, textColor=WHITE)),
            Paragraph(block["who"], ParagraphStyle('awho', parent=styles['body'],
                fontSize=8, textColor=colors.HexColor("#C0D0E8"),
                alignment=TA_RIGHT)),
        ]]
        ht = tbl(header_data, [0.75*inch, 4.0*inch, 2.15*inch], [
            ('BACKGROUND', (0,0), (-1,-1), block["color"]),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ])
        el.append(ht)

        for key, val in block["points"]:
            row = [[
                Paragraph(key, ParagraphStyle('pk', parent=styles['body'],
                    fontName='Helvetica-Bold', fontSize=8, textColor=block["color"])),
                Paragraph(val, styles['body_small']),
            ]]
            t = tbl(row, [1.4*inch, 5.5*inch], [
                ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor("#D8E0EE")),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE]),
            ])
            el.append(t)
        el.append(sp(14))

    # Closing callout
    el.append(sp(4))
    el.append(callout(
        "Bottom line: The decision to target Medicare/Medicaid and skip MCG/InterQual dependency "
        "is not just pragmatic — it is strategically correct. CMS criteria are the legally required "
        "basis for this market. The regulatory mandate is a tailwind. The platform is built. "
        "The criteria library is the work — and the moat.",
        styles
    ))

    return el

# ── Page template (header + footer) ───────────────────────────────────────────
def on_page(canvas, doc, styles):
    canvas.saveState()
    w, h = letter
    # Top accent bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 24, w, 24, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, h - 26, w, 2, fill=1, stroke=0)
    # Header text
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(WHITE)
    canvas.drawString(0.6*inch, h - 16, "LUCIDREVIEW")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#7BAFD4"))
    canvas.drawRightString(w - 0.6*inch, h - 16, "Commercialization & Execution Plan  ·  CONFIDENTIAL")
    # Footer
    canvas.setFillColor(colors.HexColor("#D0D8E8"))
    canvas.rect(0, 28, w, 0.8, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MID_GRAY)
    canvas.drawString(0.6*inch, 16, f"Prepared {date.today().strftime('%B %d, %Y')}  ·  Internal Use Only")
    canvas.drawRightString(w - 0.6*inch, 16, f"Page {doc.page}")
    canvas.restoreState()

def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        leftMargin=0.6*inch,
        rightMargin=0.6*inch,
        topMargin=0.55*inch,
        bottomMargin=0.5*inch,
        title="LucidReview Commercialization Brief",
        author="LucidReview",
        subject="Medicare/Medicaid UM Automation — Market Opportunity & Execution Plan",
    )

    styles = build_styles()

    story = []
    story += cover_page(styles)
    story += section_01(styles)
    story += section_02(styles)
    story += section_03(styles)
    story += section_04(styles)
    story += section_05(styles)

    doc.build(story, onFirstPage=lambda c, d: None,
              onLaterPages=lambda c, d: on_page(c, d, styles))

    print(f"✓ PDF written to: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
