import re
import glob

# Find all TypeScript files in the effects directories
files_to_fix = [
    'js/services/timbreEffects/effectsAudio/*.ts',
    'js/services/timbreEffects/effectsAnimation/*.ts',
    'js/services/synthEngine.ts',
    'js/services/timbreEffects/effectsCoordinator.ts'
]

# Pattern to match function calls with type annotations
pattern = r'(\w+)\(((?:\w+: [\w\[\]<>|]+(?:\s*\|\s*\w+)*(?:\s*,\s*)?)+)\)'

def remove_types(match):
    func_name = match.group(1)
    params = match.group(2)

    # Remove type annotations from parameters
    param_pattern = r'(\w+):\s*[\w\[\]<>|]+(?:\s*\|\s*\w+)*'
    cleaned_params = re.sub(param_pattern, r'\1', params)

    return f'{func_name}({cleaned_params})'

for pattern_str in files_to_fix:
    for filepath in glob.glob(pattern_str):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Apply the transformation
        fixed_content = re.sub(pattern, remove_types, content)

        # Fix switch statements
        fixed_content = fixed_content.replace('switch (annotation.type: string)', 'switch (annotation.type)')
        fixed_content = fixed_content.replace('switch (this.tempAnnotation.type: string)', 'switch (this.tempAnnotation.type)')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)

        print(f"Fixed {filepath}")

print("All files fixed!")
