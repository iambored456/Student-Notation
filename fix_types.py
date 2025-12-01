import re

# Read the file
with open('js/services/annotationService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match function calls with type annotations
# Matches patterns like: functionName(param: type, param2: type)
pattern = r'(\w+)\(((?:\w+: [\w\[\]<>|]+(?:\s*\|\s*\w+)*(?:\s*,\s*)?)+)\)'

def remove_types(match):
    func_name = match.group(1)
    params = match.group(2)

    # Remove type annotations from parameters
    # Match pattern: paramName: type
    param_pattern = r'(\w+):\s*[\w\[\]<>|]+(?:\s*\|\s*\w+)*'
    cleaned_params = re.sub(param_pattern, r'\1', params)

    return f'{func_name}({cleaned_params})'

# Apply the transformation
fixed_content = re.sub(pattern, remove_types, content)

# Write back
with open('js/services/annotationService.ts', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print("Fixed type annotations in function calls")
