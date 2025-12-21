#!/usr/bin/env python3
"""Create SVG logos for partner organizations"""

import os

os.makedirs('assets/images/partners', exist_ok=True)

logos = [
    ('interpol', 'Interpol', '#C8102E', 18, ''),
    ('easa', 'EASA', '#003399', 20, 'European Aviation Safety Agency'),
    ('imdg', 'IMDG', '#E30613', 20, 'Dangerous Goods Code'),
    ('ifalpa', 'IFALPA', '#0066CC', 20, 'Int. Federation of Airline Pilots'),
    ('eurocontrol', 'Eurocontrol', '#003087', 18, ''),
    ('asean', 'ASEAN', '#B8860B', 20, ''),
    ('oecd', 'OECD', '#003478', 22, ''),
    ('apec', 'APEC', '#00247D', 20, ''),
    ('sita', 'SITA', '#CE1126', 18, 'Air Transport IT'),
    ('tiaca', 'TIACA', '#009639', 20, 'The Int. Air Cargo Association'),
    ('fiata', 'FIATA', '#004080', 20, 'Int. Federation of Freight Forwarders'),
    ('bimco', 'BIMCO', '#005EB8', 20, 'Baltic and International Maritime Council'),
    ('wco', 'WCO', '#D32F2F', 20, 'World Customs Organization'),
    ('iru', 'IRU', '#006400', 20, 'International Road Transport Union'),
    ('uic', 'UIC', '#8B0000', 20, 'International Union of Railways'),
]

for filename, text, color, fontsize, subtitle in logos:
    svg_content = f'''<svg width="120" height="60" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="60" fill="white"/>
  <text x="60" y="35" font-family="Arial, sans-serif" font-size="{fontsize}" font-weight="bold" text-anchor="middle" fill="{color}">{text}</text>'''

    if subtitle:
        svg_content += f'\n  <text x="60" y="48" font-family="Arial, sans-serif" font-size="7" text-anchor="middle" fill="#666">{subtitle}</text>'

    svg_content += '\n</svg>'

    with open(f'assets/images/partners/{filename}.svg', 'w') as f:
        f.write(svg_content)

    print(f"[OK] Created {filename}.svg")

print("\n[OK] All partner logos created!")
