import pandas as pd
import numpy as np

# Load dataset
df = pd.read_excel('data/data set GaitClass.xlsx', sheet_name='Dataset')
df.columns = df.columns.str.strip()

# Binary: Group 0 (Healthy) vs Group 2 (KOA)
df_binary = df[df['Group'].isin([0, 2])].copy()
df_binary['target'] = (df_binary['Group'] == 2).astype(int)

cols = [c for c in df_binary.columns if c not in ['ID', 'Group', 'target']]
print(f'Total binary subjects: {len(df_binary)}')
print(f'Healthy (Group 0): {(df_binary["target"] == 0).sum()}')
print(f'KOA (Group 2): {(df_binary["target"] == 1).sum()}')

corrs = df_binary[cols + ['target']].corr()['target'].drop('target').sort_values(key=abs, ascending=False)
print('\n=== CORRELATION WITH KOA TARGET (Ranked by absolute r) ===')
for col, corr in corrs.items():
    h_m = df_binary[df_binary['target'] == 0][col].mean()
    k_m = df_binary[df_binary['target'] == 1][col].mean()
    print(f'{col:32s}: r = {corr:+.4f} | Healthy: {h_m:8.3f} | KOA: {k_m:8.3f}')
