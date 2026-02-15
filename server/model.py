"""
Updated Model Training Script for Domus Memoriae

Trains a survivability prediction model using the complete feature set
that matches app.py's extract_ml_features() function.
"""

import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import numpy as np

# Configuration
CSV_PATH = "server/data.csv"
MODEL_PATH = "model.pkl"
TARGET = "survivability_score"
TEST_SIZE = 0.2
RANDOM_STATE = 42

# Columns to drop (not used as features)
DROP_COLS = {
    TARGET,
    # These are stored in DB but not used for prediction
    "mime_claimed",  # Only mime_mismatch matters (derived feature)
    "mime_detected",  # Only mime_mismatch matters (derived feature)
}

def load_and_prepare_data(csv_path):
    """Load CSV and prepare features for training"""
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    print(f"  Loaded {len(df)} samples with {len(df.columns)} columns")
    
    # Verify required columns exist
    if TARGET not in df.columns:
        raise ValueError(f"Target column '{TARGET}' not found in CSV")
    
    required_features = [
        'ext', 'file_type', 'format_risk', 'size_bytes', 
        'metadata_score', 'access_risk_score', 'duplicate_count',
        'access_count', 'file_age_days', 'mime_mismatch'
    ]
    
    missing_features = [f for f in required_features if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")
    
    # Build feature set (exclude target and unnecessary columns)
    feature_cols = [c for c in df.columns if c not in DROP_COLS]
    
    X = df[feature_cols]
    y = df[TARGET]
    
    print(f"  Features: {feature_cols}")
    print(f"  Target: {TARGET}")
    print(f"  Target range: [{y.min():.2f}, {y.max():.2f}]")
    print(f"  Target mean: {y.mean():.2f} ± {y.std():.2f}")
    
    return X, y, feature_cols

def create_preprocessing_pipeline(X, feature_cols):
    """Create sklearn preprocessing pipeline"""
    
    # Identify numeric vs categorical columns
    num_cols = [c for c in feature_cols if pd.api.types.is_numeric_dtype(X[c])]
    cat_cols = [c for c in feature_cols if c not in num_cols]
    
    print(f"\nFeature types:")
    print(f"  Numeric ({len(num_cols)}): {num_cols}")
    print(f"  Categorical ({len(cat_cols)}): {cat_cols}")
    
    # Create preprocessing steps
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), num_cols),
            ("cat", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]), cat_cols),
        ],
        remainder="drop",
    )
    
    return preprocessor

def train_model(X_train, y_train):
    """Train Random Forest model"""
    print("\nTraining Random Forest Regressor...")
    
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        verbose=0
    )
    
    model.fit(X_train, y_train)
    
    return model

def evaluate_model(pipeline, X_test, y_test):
    """Evaluate model performance"""
    print("\nEvaluating model...")
    
    # Make predictions
    y_pred = pipeline.predict(X_test)
    
    # Calculate metrics
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    rmse = np.sqrt(np.mean((y_test - y_pred) ** 2))
    
    # Calculate percentage of predictions within certain error ranges
    errors = np.abs(y_test - y_pred)
    within_5 = (errors <= 5).sum() / len(errors) * 100
    within_10 = (errors <= 10).sum() / len(errors) * 100
    within_15 = (errors <= 15).sum() / len(errors) * 100
    
    print(f"\n{'='*60}")
    print("MODEL PERFORMANCE METRICS")
    print(f"{'='*60}")
    print(f"Mean Absolute Error (MAE):  {mae:.3f}")
    print(f"Root Mean Squared Error:    {rmse:.3f}")
    print(f"R² Score:                   {r2:.4f}")
    print(f"\nPrediction Accuracy:")
    print(f"  Within ±5 points:   {within_5:.1f}%")
    print(f"  Within ±10 points:  {within_10:.1f}%")
    print(f"  Within ±15 points:  {within_15:.1f}%")
    print(f"{'='*60}")
    
    # Show some example predictions
    print("\nExample Predictions (first 10 test samples):")
    print(f"{'Actual':>8} {'Predicted':>10} {'Error':>8}")
    print("-" * 30)
    for i in range(min(10, len(y_test))):
        actual = y_test.iloc[i]
        predicted = y_pred[i]
        error = actual - predicted
        print(f"{actual:>8.2f} {predicted:>10.2f} {error:>8.2f}")
    
    return mae, r2

def save_model(pipeline, model_path, feature_cols):
    """Save trained model to disk"""
    print(f"\nSaving model to {model_path}...")
    
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    
    print(f"✅ Model saved successfully")
    print(f"   Features used: {feature_cols}")
    
    # Verify the model can be loaded
    with open(model_path, "rb") as f:
        loaded_model = pickle.load(f)
    print(f"✅ Model verified (can be loaded)")

def main():
    """Main training pipeline"""
    print("="*60)
    print("DOMUS MEMORIAE SURVIVABILITY MODEL TRAINING")
    print("="*60)
    
    # Load data
    X, y, feature_cols = load_and_prepare_data(CSV_PATH)
    
    # Create preprocessing pipeline
    preprocessor = create_preprocessing_pipeline(X, feature_cols)
    
    # Split data
    print(f"\nSplitting data (test_size={TEST_SIZE})...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples:     {len(X_test)}")
    
    # Create full pipeline
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", train_model(preprocessor.fit_transform(X_train), y_train))
    ])
    
    # Refit the full pipeline on training data
    print("\nFitting complete pipeline...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    mae, r2 = evaluate_model(pipeline, X_test, y_test)
    
    # Save model
    save_model(pipeline, MODEL_PATH, feature_cols)
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE")
    print("="*60)
    print(f"Model ready for deployment!")
    print(f"To use in your app, ensure model.pkl is in the same directory")
    print(f"as app.py (or set MODEL_PATH environment variable)")
    
    return pipeline, mae, r2

if __name__ == "__main__":
    try:
        pipeline, mae, r2 = main()
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)