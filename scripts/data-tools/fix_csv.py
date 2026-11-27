#!/usr/bin/env python3
"""
Fix malformed CSV file by properly handling quoted fields
"""

import csv
import sys

def fix_csv(input_file, output_file):
    """Read and rewrite CSV with proper formatting"""

    # Read the original file line by line
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    # Parse header
    header = lines[0].strip()

    # Fixed data
    fixed_lines = [header]

    for i, line in enumerate(lines[1:], 1):
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # If line starts with quote, it's malformed
        if line.startswith('"'):
            # Extract the data between the first quote and the last quote before the commas
            # Pattern: "id,term_ja,reading,term_en,term_zh,category,subcategory,priority,notes",,,,,,,
            # We need to extract the content and remove trailing empty fields

            # Remove the leading quote
            line = line[1:]

            # Find the closing quote before the trailing commas
            # Split by quote to find the actual data
            parts = line.split('"')
            if len(parts) >= 1:
                data = parts[0]  # This is the actual CSV data
                fixed_lines.append(data)
        else:
            # Line is fine, keep it
            fixed_lines.append(line)

    # Write fixed CSV
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines) + '\n')

    print(f"Fixed {len(fixed_lines) - 1} data rows")
    print(f"Output written to: {output_file}")

if __name__ == '__main__':
    input_file = '../料理データ.csv'
    output_file = '../料理データ.csv'

    fix_csv(input_file, output_file)
