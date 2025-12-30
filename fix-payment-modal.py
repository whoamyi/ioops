#!/usr/bin/env python3
"""
Script to fix payment modal height for mobile viewports
"""

import re

# Read the HTML file
with open('recipient-verification.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix payment modal outer container - add overflow-y and padding
old_modal_outer = r'<div id="payment-method-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba\(0,0,0,0\.6\); z-index: 10000; align-items: center; justify-content: center;">'

new_modal_outer = '<div id="payment-method-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; overflow-y: auto; padding: 20px 0;">'

content = re.sub(old_modal_outer, new_modal_outer, content)

# Fix payment modal inner container - add max-height and margin
old_modal_inner = r'<div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; box-shadow: 0 8px 32px rgba\(0,0,0,0\.2\);">'

new_modal_inner = '<div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2); margin: auto;">'

content = re.sub(old_modal_inner, new_modal_inner, content)

# Write back
with open('recipient-verification.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Payment modal fixed for mobile viewports!")
