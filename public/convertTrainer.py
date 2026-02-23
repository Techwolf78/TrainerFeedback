import pandas as pd
import json

# Input CSV file
csv_file = "trainers_export.csv"

# Output JSON file
json_file = "trainers_output.json"

# Read CSV
df = pd.read_csv(csv_file)

# Rename columns to match addTrainer service parameters
column_mapping = {
    "Id": "trainer_id",
    "Full name": "name",
    "Domain": "domain",
    "Specialization": "specialisation",
    "email": "email"
}
df = df.rename(columns=column_mapping)

# Add trainer_id as password and initialize topics list
df["password"] = df["trainer_id"].astype(str).str.lower().str.replace("-", "")
df["topics"] = [[] for _ in range(len(df))]

# Convert to list of dictionaries
data = df.to_dict(orient="records")

# Write JSON file
with open(json_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"✅ JSON file saved as {json_file}")
