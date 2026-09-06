import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix, classification_report

# Load and prepare data
df = pd.read_excel('data/data set GaitClass.xlsx', sheet_name='Dataset')
df.columns = df.columns.str.strip()

# Binary filter: Group 0 (Healthy) vs Group 2 (KOA)
df_binary = df[df['Group'].isin([0, 2])].copy()
df_binary['target'] = (df_binary['Group'] == 2).astype(int)

feature_cols = [c for c in df_binary.columns if c not in ['ID', 'Group', 'target']]
X = df_binary[feature_cols]
y = df_binary['target']

print(f"Features count: {len(feature_cols)}")
print(f"X shape: {X.shape}, y distribution: {dict(y.value_counts())}")

# Stratified Train/Test Split (80% train, 20% test, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"Train samples: {len(X_train)} (Healthy: {(y_train==0).sum()}, KOA: {(y_train==1).sum()})")
print(f"Test samples: {len(X_test)} (Healthy: {(y_test==0).sum()}, KOA: {(y_test==1).sum()})")

models = {
    "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced'),
    "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, class_weight='balanced'),
    "GradientBoosting": GradientBoostingClassifier(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42),
    "SVC": SVC(probability=True, random_state=42, class_weight='balanced')
}

print("\n=== 5-FOLD STRATIFIED CV ON TRAIN SET & TEST SET EVALUATION ===")
for name, clf in models.items():
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', clf)
    ])
    
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_f1 = cross_val_score(pipe, X_train, y_train, cv=cv, scoring='f1')
    cv_acc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring='accuracy')
    cv_auc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring='roc_auc')
    
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)
    
    print(f"\n--- {name} ---")
    print(f"  Train 5-Fold CV: F1={cv_f1.mean():.4f} (±{cv_f1.std():.4f}), Acc={cv_acc.mean():.4f}, AUC={cv_auc.mean():.4f}")
    print(f"  Test Accuracy:   {acc:.4f}")
    print(f"  Test Precision:  {prec:.4f}")
    print(f"  Test Recall:     {rec:.4f}")
    print(f"  Test F1-Score:   {f1:.4f}")
    print(f"  Test ROC-AUC:    {auc:.4f}")
    print(f"  Confusion Matrix (TN, FP / FN, TP):\n{cm}")
