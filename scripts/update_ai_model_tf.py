import requests
from bs4 import BeautifulSoup
import re
import os
import sys

MODEL_DOC_URL = "https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/model-retirements#current-models"
TF_FILE_PATH = "components/infrastructure/ai-model.tf"

def get_current_model_version():
    with open(TF_FILE_PATH) as f:
        content = f.read()
    model_match = re.search(r'model\s*{[^}]*name\s*=\s*"([^"]+)"', content, re.DOTALL)
    version_match = re.search(r'model\s*{[^}]*version\s*=\s*"([^"]+)"', content, re.DOTALL)
    if model_match and version_match:
        return model_match.group(1), version_match.group(1)
    return None, None

def get_replacement_model(current_model, current_version):
    response = requests.get(MODEL_DOC_URL)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if not table:
        return None, None
    rows = table.find_all("tr")[1:]
    for row in rows:
        cells = row.find_all("td")
        if len(cells) >= 4:
            model = cells[0].get_text(strip=True)
            version = cells[1].get_text(strip=True)
            replacement = cells[3].get_text(separator=" ", strip=True)
            # Match current model/version
            if model == current_model and version == current_version:
                match = re.search(r"(gpt-\S+)\s*version[:\s]+(\d{4}-\d{2}-\d{2})", replacement)
                if match:
                    return match.group(1), match.group(2)
    return None, None

def update_model_block(content, model_name, model_version):
    def replacer(match):
        block = match.group(0)
        block = re.sub(r'name\s*=\s*".*"', f'name    = "{model_name}"', block)
        block = re.sub(r'version\s*=\s*".*"', f'version = "{model_version}"', block)
        return block
    return re.sub(r'model\s*{[^}]*}', replacer, content, flags=re.DOTALL)

def dry_run_tf_file(model_name, model_version):
    with open(TF_FILE_PATH) as f:
        content = f.read()
    new_content = update_model_block(content, model_name, model_version)
    branch = f"auto/update-ai-model-{model_name}-{model_version.replace('-', '')}"
    pr_title = f"Auto: Update AI model to {model_name} {model_version}"
    pr_body = (
        f"This PR was automatically generated to update the AI model and version in ai-model.tf to avoid retirement.\n"
        f"See https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/model-retirements#current-models for details."
    )
    print("----- Proposed ai-model.tf changes -----")
    print(new_content)
    print("----- End of proposed changes -----\n")
    print(f"Branch to be created: {branch}")
    print(f"PR Title: {pr_title}")
    print(f"PR Body:\n{pr_body}\n")

def update_tf_file(model_name, model_version):
    with open(TF_FILE_PATH) as f:
        content = f.read()
    new_content = update_model_block(content, model_name, model_version)
    with open(TF_FILE_PATH, "w") as f:
        f.write(new_content)
    os.system(f"terraform fmt {TF_FILE_PATH}")

if __name__ == "__main__":
    current_model, current_version = get_current_model_version()
    if not current_model or not current_version:
        print("Could not read current model/version from ai-model.tf")
        sys.exit(1)
    model_name, model_version = get_replacement_model(current_model, current_version)
    if model_name and model_version:
        # dry_run_tf_file(model_name, model_version)
        update_tf_file(model_name, model_version)
    else:
        print("Could not find replacement model info for", current_model, current_version)