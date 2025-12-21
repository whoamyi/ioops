#!/usr/bin/env python3
"""
Generate IOOPS Standards and Resource PDFs
Creates realistic documentation for the IOOPS website
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, ListFlowable, ListItem
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
import os
from datetime import datetime

# Ensure output directory exists
os.makedirs('assets/docs', exist_ok=True)

def add_header_footer(canvas, doc):
    """Add header and footer to each page"""
    canvas.saveState()

    # Header
    canvas.setFont('Helvetica', 9)
    canvas.setFillColorRGB(0.17, 0.35, 0.63)  # IOOPS blue
    canvas.drawString(inch, letter[1] - 0.5*inch, "IOOPS - International Operations & Oversight Protocol System")

    # Footer
    canvas.setFont('Helvetica-Oblique', 8)
    canvas.setFillColorRGB(0.5, 0.5, 0.5)
    canvas.drawString(inch, 0.5*inch, f"© 2025 IOOPS. All rights reserved.")
    canvas.drawRightString(letter[0] - inch, 0.5*inch, f"Page {doc.page}")

    canvas.restoreState()

def create_std_001():
    """IOOPS-STD-001: Transit Documentation Protocol"""
    filename = 'assets/docs/IOOPS-STD-001.pdf'
    doc = SimpleDocTemplate(filename, pagesize=letter,
                           topMargin=inch, bottomMargin=inch,
                           leftMargin=inch, rightMargin=inch)

    styles = getSampleStyleSheet()
    story = []

    # Custom styles
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'],
                                fontSize=24, textColor=colors.HexColor('#2C5AA0'),
                                spaceAfter=30, alignment=TA_CENTER)

    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'],
                                  fontSize=14, textColor=colors.HexColor('#2C5AA0'),
                                  spaceAfter=12, spaceBefore=12)

    # Title Page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("IOOPS-STD-001", title_style))
    story.append(Paragraph("Transit Documentation Protocol", styles['Heading2']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Version 3.2", styles['Normal']))
    story.append(Paragraph("January 2025", styles['Normal']))
    story.append(Spacer(1, inch))
    story.append(Paragraph("International Operations & Oversight Protocol System", styles['Normal']))
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph("Table of Contents", heading_style))
    toc_data = [
        ["1. Introduction", "3"],
        ["2. Scope and Applicability", "4"],
        ["3. Documentation Requirements", "6"],
        ["4. Transit Manifest Specifications", "10"],
        ["5. Cross-Border Documentation", "15"],
        ["6. Digital Documentation Standards", "20"],
        ["7. Compliance Verification Procedures", "25"],
        ["8. Record Retention Requirements", "30"],
        ["9. Glossary", "35"],
        ["10. References", "40"]
    ]
    toc_table = Table(toc_data, colWidths=[4.5*inch, inch])
    toc_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # Chapter 1: Introduction
    story.append(Paragraph("1. Introduction", heading_style))
    story.append(Paragraph(
        "This standard establishes comprehensive documentation requirements for international transit operations "
        "under the IOOPS framework. It ensures consistent, verifiable, and secure documentation across all "
        "participating jurisdictions and operational entities.", styles['BodyText']))
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph("1.1 Purpose", styles['Heading3']))
    story.append(Paragraph(
        "The Transit Documentation Protocol provides authoritative guidance for maintaining operational documentation "
        "that meets international standards while ensuring compliance with local regulatory requirements. This protocol "
        "establishes minimum documentation standards applicable to all transit operations within IOOPS member jurisdictions.",
        styles['BodyText']))
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph("1.2 Authority", styles['Heading3']))
    story.append(Paragraph(
        "This standard is issued under the authority of the IOOPS Executive Council and is mandatory for all operational "
        "entities conducting transit operations within member jurisdictions. Compliance is verified through the IOOPS "
        "Compliance Verification Framework (IOOPS-STD-002).", styles['BodyText']))
    story.append(PageBreak())

    # Chapter 2: Scope
    story.append(Paragraph("2. Scope and Applicability", heading_style))
    story.append(Paragraph(
        "This standard applies to all documentation associated with international transit operations, including:",
        styles['BodyText']))
    story.append(Spacer(1, 0.1*inch))

    scope_items = [
        "Transit manifests and cargo documentation",
        "Operator certification and authorization documents",
        "Safety and compliance certificates",
        "Customs and regulatory filings",
        "Digital transaction records",
        "Operational logs and incident reports"
    ]

    for item in scope_items:
        story.append(Paragraph(f"• {item}", styles['BodyText']))

    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("2.1 Operational Entities", styles['Heading3']))
    story.append(Paragraph(
        "This standard is mandatory for: (a) Licensed transit operators, (b) Coordinating authorities, "
        "(c) Verification agents, (d) Digital platform providers, and (e) Any entity facilitating or managing "
        "international transit operations.", styles['BodyText']))

    story.append(PageBreak())

    # Chapter 3: Documentation Requirements
    story.append(Paragraph("3. Documentation Requirements", heading_style))
    story.append(Paragraph(
        "All operational entities must maintain documentation in accordance with the following requirements:",
        styles['BodyText']))
    story.append(Spacer(1, 0.2*inch))

    # Requirements Table
    req_data = [
        ["Category", "Requirement", "Retention Period"],
        ["Transit Manifest", "Completed for all movements", "7 years"],
        ["Operator Credentials", "Current and verified", "Duration + 2 years"],
        ["Safety Certificates", "Annual renewal minimum", "10 years"],
        ["Incident Reports", "Within 24 hours of event", "Permanent"],
        ["Customs Documentation", "Per jurisdiction requirements", "Per regulations"],
    ]

    req_table = Table(req_data, colWidths=[1.8*inch, 2.2*inch, 1.5*inch])
    req_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C5AA0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
    ]))
    story.append(req_table)

    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("3.1 Digital Documentation Standards", styles['Heading3']))
    story.append(Paragraph(
        "All digital documentation must comply with IOOPS-STD-005 (Digital Systems Integration Protocol), "
        "including encryption, authentication, and audit trail requirements. Digital signatures must use "
        "approved cryptographic standards and maintain non-repudiation capabilities.",
        styles['BodyText']))

    # Additional pages with more detail
    for i in range(10):
        story.append(PageBreak())
        story.append(Paragraph(f"3.{i+2} Additional Requirements Section {i+1}", styles['Heading3']))
        story.append(Paragraph(
            "Detailed requirements continue with specific subsections covering implementation guidelines, "
            "compliance verification procedures, reporting formats, and technical specifications. "
            "Operational entities must ensure complete understanding and implementation of all sections.",
            styles['BodyText']))
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(
            "Each section provides comprehensive guidance with examples, templates, and cross-references "
            "to related IOOPS standards. Entities are advised to consult with regional coordination offices "
            "for jurisdiction-specific implementation guidance.",
            styles['BodyText']))

    # Build PDF
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"[OK] Generated {filename}")

def create_std_002():
    """IOOPS-STD-002: Compliance Verification Framework"""
    filename = 'assets/docs/IOOPS-STD-002.pdf'
    doc = SimpleDocTemplate(filename, pagesize=letter,
                           topMargin=inch, bottomMargin=inch)

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'],
                                fontSize=24, textColor=colors.HexColor('#2C5AA0'),
                                spaceAfter=30, alignment=TA_CENTER)

    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'],
                                  fontSize=14, textColor=colors.HexColor('#2C5AA0'),
                                  spaceAfter=12, spaceBefore=12)

    # Title Page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("IOOPS-STD-002", title_style))
    story.append(Paragraph("Compliance Verification Framework", styles['Heading2']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Version 2.5 | November 2024", styles['Normal']))
    story.append(PageBreak())

    # Content
    story.append(Paragraph("Executive Summary", heading_style))
    story.append(Paragraph(
        "The Compliance Verification Framework establishes systematic procedures for verifying operational "
        "compliance with IOOPS protocols across all member jurisdictions. This framework ensures consistent, "
        "objective assessment of operational entities while maintaining flexibility for jurisdiction-specific requirements.",
        styles['BodyText']))
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("1. Verification Methodology", heading_style))
    story.append(Paragraph(
        "IOOPS employs a multi-tiered verification approach combining: (1) Self-assessment and reporting, "
        "(2) Document review and analysis, (3) On-site inspection and audit, (4) Continuous monitoring and surveillance, "
        "(5) Periodic re-certification procedures.", styles['BodyText']))
    story.append(Spacer(1, 0.2*inch))

    # Verification Process Table
    process_data = [
        ["Phase", "Duration", "Activities"],
        ["Initial Assessment", "30 days", "Document review, preliminary evaluation"],
        ["On-Site Audit", "3-5 days", "Physical inspection, staff interviews"],
        ["Report & Analysis", "15 days", "Findings compilation, recommendations"],
        ["Corrective Action", "60 days", "Entity implementation, follow-up"],
        ["Final Certification", "10 days", "Approval process, certificate issuance"],
    ]

    process_table = Table(process_data, colWidths=[1.8*inch, 1.3*inch, 2.4*inch])
    process_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C5AA0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
    ]))
    story.append(process_table)

    # Add more content pages
    for i in range(8):
        story.append(PageBreak())
        story.append(Paragraph(f"{i+2}. Compliance Requirements Section {i+1}", heading_style))
        story.append(Paragraph(
            "This section details specific compliance criteria, evaluation methodologies, and scoring mechanisms. "
            "Operational entities must demonstrate adherence to all applicable standards through documented evidence "
            "and operational performance metrics.", styles['BodyText']))

    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"[OK] Generated {filename}")

def create_remaining_standards():
    """Create STD-003, 004, and 005"""
    standards = [
        {
            'filename': 'assets/docs/IOOPS-STD-003.pdf',
            'code': 'IOOPS-STD-003',
            'title': 'Multi-Jurisdictional Coordination Standards',
            'version': 'Version 4.0 | October 2024',
            'pages': 13
        },
        {
            'filename': 'assets/docs/IOOPS-STD-004.pdf',
            'code': 'IOOPS-STD-004',
            'title': 'Operational Continuity Management',
            'version': 'Version 2.1 | September 2024',
            'pages': 11
        },
        {
            'filename': 'assets/docs/IOOPS-STD-005.pdf',
            'code': 'IOOPS-STD-005',
            'title': 'Digital Systems Integration Protocol',
            'version': 'Version 1.8 | August 2024',
            'pages': 14
        }
    ]

    for std in standards:
        doc = SimpleDocTemplate(std['filename'], pagesize=letter,
                               topMargin=inch, bottomMargin=inch)

        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'],
                                    fontSize=24, textColor=colors.HexColor('#2C5AA0'),
                                    spaceAfter=30, alignment=TA_CENTER)

        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'],
                                      fontSize=14, textColor=colors.HexColor('#2C5AA0'),
                                      spaceAfter=12, spaceBefore=12)

        # Title Page
        story.append(Spacer(1, 2*inch))
        story.append(Paragraph(std['code'], title_style))
        story.append(Paragraph(std['title'], styles['Heading2']))
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph(std['version'], styles['Normal']))
        story.append(PageBreak())

        # Content pages
        for i in range(std['pages']):
            story.append(Paragraph(f"{i+1}. {std['title']} - Section {i+1}", heading_style))
            story.append(Paragraph(
                f"This standard provides comprehensive guidance on {std['title'].lower()}. "
                "Operational entities must ensure full compliance with all requirements outlined in this document. "
                "Regular updates and revisions ensure alignment with evolving international best practices.",
                styles['BodyText']))
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph(
                "Detailed requirements, implementation guidelines, and compliance verification procedures "
                "are provided throughout this document. Entities should consult with IOOPS coordination offices "
                "for jurisdiction-specific guidance and support.", styles['BodyText']))
            if i < std['pages'] - 1:
                story.append(PageBreak())

        doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
        print(f"[OK] Generated {std['filename']}")

def create_quick_reference_guides():
    """Create Quick Reference Guides"""
    guides = [
        {
            'filename': 'assets/docs/Quick-Start-Guide.pdf',
            'title': 'Quick Start Guide for New Operational Entities',
            'subtitle': 'Essential Information for Beginning IOOPS Compliance',
            'pages': 3
        },
        {
            'filename': 'assets/docs/Incident-Report-Template.pdf',
            'title': 'Incident Reporting Template',
            'subtitle': 'Standardized Format for Operational Incident Documentation',
            'pages': 2
        }
    ]

    for guide in guides:
        doc = SimpleDocTemplate(guide['filename'], pagesize=letter,
                               topMargin=inch, bottomMargin=inch)

        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'],
                                    fontSize=20, textColor=colors.HexColor('#2C5AA0'),
                                    spaceAfter=20, alignment=TA_CENTER)

        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'],
                                      fontSize=13, textColor=colors.HexColor('#2C5AA0'),
                                      spaceAfter=10, spaceBefore=10)

        story.append(Paragraph(guide['title'], title_style))
        story.append(Paragraph(guide['subtitle'], styles['Normal']))
        story.append(Spacer(1, 0.3*inch))

        # Content
        for i in range(guide['pages']):
            story.append(Paragraph(f"Section {i+1}", heading_style))
            story.append(Paragraph(
                "This guide provides essential information for operational entities. "
                "Follow these procedures to ensure compliance with IOOPS protocols and maintain "
                "operational excellence across all jurisdictions.", styles['BodyText']))
            story.append(Spacer(1, 0.2*inch))

            if guide['filename'].endswith('Template.pdf') and i == 0:
                # Add a template table for incident report
                template_data = [
                    ["Field", "Information"],
                    ["Incident Date/Time:", ""],
                    ["Location:", ""],
                    ["Entity ID:", ""],
                    ["Incident Type:", ""],
                    ["Description:", ""],
                    ["Action Taken:", ""],
                    ["Reporting Officer:", ""],
                ]
                template_table = Table(template_data, colWidths=[2*inch, 3.5*inch])
                template_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C5AA0')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
                ]))
                story.append(template_table)

            if i < guide['pages'] - 1:
                story.append(PageBreak())

        doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
        print(f"[OK] Generated {guide['filename']}")

def create_compliance_checklist():
    """Create Excel-style compliance checklist"""
    # Create a PDF that looks like a checklist/form
    filename = 'assets/docs/Compliance-Checklist.xlsx'
    # For now, create a PDF version
    pdf_filename = 'assets/docs/Compliance-Checklist.pdf'

    doc = SimpleDocTemplate(pdf_filename, pagesize=letter,
                           topMargin=inch, bottomMargin=inch)

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'],
                                fontSize=20, textColor=colors.HexColor('#2C5AA0'),
                                spaceAfter=20, alignment=TA_CENTER)

    story.append(Paragraph("IOOPS Compliance Checklist", title_style))
    story.append(Paragraph("Self-Assessment Template for Operational Entities", styles['Normal']))
    story.append(Spacer(1, 0.3*inch))

    # Checklist Table
    checklist_data = [
        ["☐", "Requirement", "Status", "Notes"],
        ["☐", "IOOPS-STD-001 Documentation Complete", "", ""],
        ["☐", "Operator Certifications Current", "", ""],
        ["☐", "Safety Protocols Implemented", "", ""],
        ["☐", "Digital Systems Integrated (STD-005)", "", ""],
        ["☐", "Staff Training Completed", "", ""],
        ["☐", "Emergency Procedures Documented", "", ""],
        ["☐", "Incident Reporting System Active", "", ""],
        ["☐", "Audit Trail Mechanisms in Place", "", ""],
        ["☐", "Cross-Border Coordination Established", "", ""],
        ["☐", "Compliance Verification Schedule Set", "", ""],
    ]

    checklist_table = Table(checklist_data, colWidths=[0.4*inch, 2.8*inch, 1*inch, 1.3*inch])
    checklist_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C5AA0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (0, -1), 14),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
    ]))
    story.append(checklist_table)

    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(
        "Instructions: Check each box upon completion of the requirement. Document status and notes for internal tracking. "
        "Submit completed checklist to regional coordination office for verification.",
        styles['BodyText']))

    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"[OK] Generated {pdf_filename}")

    # Create a note file for the xlsx
    with open(filename + '.txt', 'w') as f:
        f.write("Excel version available through IOOPS Member Portal\n")
        f.write("PDF version: Compliance-Checklist.pdf\n")

if __name__ == '__main__':
    print("Generating IOOPS Documentation PDFs...")
    print("=" * 50)

    try:
        create_std_001()
        create_std_002()
        create_remaining_standards()
        create_quick_reference_guides()
        create_compliance_checklist()

        print("=" * 50)
        print("[OK] All PDFs generated successfully!")
        print(f"Output directory: assets/docs/")

    except ImportError as e:
        print(f"\n[ERROR] Error: Required Python package not found")
        print(f"Please install: pip install reportlab")
        print(f"Error details: {e}")
    except Exception as e:
        print(f"\n[ERROR] Error generating PDFs: {e}")
