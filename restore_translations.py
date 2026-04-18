
import os

with open('/app/applet/dist/assets/index-DTDk0lY7.js', 'r') as f:
    f.seek(451172)
    chunk = f.read(100000) # Read a large chunk

# Simple brace matching to find the end of the object
depth = 0
found_end = -1
for i, char in enumerate(chunk):
    if char == '{':
        depth += 1
    elif char == '}':
        depth -= 1
        if depth == 0:
            found_end = i
            break

if found_end != -1:
    content = chunk[:found_end+1]
    # Remove 'const jy=' and replace it with 'export const translations ='
    # and add the Language type
    ts_content = "/**\n * @license\n * SPDX-License-Identifier: Apache-2.0\n */\n\n"
    ts_content += "export type Language = 'en' | 'ar';\n\n"
    ts_content += "export const translations = " + content.replace('const jy=', '') + ";\n"
    
    with open('/app/applet/src/i18n/translations.ts', 'w') as f_out:
        f_out.write(ts_content)
    print("Successfully restored translations.ts")
else:
    print("Could not find end of object")
