# model.py
"""
Simple survivability regressor trainer.

- Reads data.csv (must be in same directory)
- Trains a simple regression model
- Saves it as model.pkl
"""

import pickle
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error


# -----------------------------
# Config
# -----------------------------

CSV_PATH = "server/data.csv"
TARGET = "survivability_score"

# Columns to never use as ML features
DROP_COLS = {
    TARGET,
    "id", "_id", "file_id", "user_id", "vault_id",
    "stored_key", "original_filename", "sha256",
    "metadata_json", "access_risk_reason",
    "uploaded_at", "last_accessed_at",
}


def main():
    df = pd.read_csv(CSV_PATH)

    if TARGET not in df.columns:
        raise ValueError(f"CSV must include target column '{TARGET}'. Found: {list(df.columns)}")

    # Build feature set
    feature_cols = [c for c in df.columns if c not in DROP_COLS]
    X = df[feature_cols]
    y = df[TARGET]

    # Separate numeric vs categorical
    num_cols = [c for c in feature_cols if pd.api.types.is_numeric_dtype(df[c])]
    cat_cols = [c for c in feature_cols if c not in num_cols]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), num_cols),
            ("cat", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]), cat_cols),
        ],
        remainder="drop",
    )

    model = RandomForestRegressor(
        n_estimators=300,
        random_state=42,
        n_jobs=-1,
    )

    pipe = Pipeline([
        ("prep", preprocessor),
        ("model", model),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipe.fit(X_train, y_train)

    preds = pipe.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"✅ Trained. MAE: {mae:.3f}")

    # Save model
    with open("model.pkl", "wb") as f:
        pickle.dump(pipe, f)

    print("✅ Saved model to model.pkl")
    print("Features used:", feature_cols)


if __name__ == "__main__":
    main()
