import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib

def generate_synthetic_data(num_samples=5000):
    np.random.seed(42)
    order_size = np.random.randint(1, 25, size=num_samples)
    stock_ratio = np.random.uniform(0.05, 1.0, size=num_samples)
    concurrent_requests = np.random.randint(1, 150, size=num_samples)
    warehouse_load = np.random.randint(1, 6, size=num_samples)

    base_latency = 45.0
    latency = (
        base_latency
        + (order_size * 2.8)
        + (concurrent_requests * 1.5)
        + ((1.0 - stock_ratio) * 120.0)
        + (warehouse_load * 12.0)
        + np.random.normal(0, 8, size=num_samples)
    )

    df = pd.DataFrame({
        'order_size': order_size,
        'stock_ratio': stock_ratio,
        'concurrent_requests': concurrent_requests,
        'warehouse_load': warehouse_load,
        'latency_ms': np.round(latency, 2)
    })
    return df

def train_bottleneck_model():
    print("[1/4] Generating 5,000 synthetic fulfilment logs...")
    data = generate_synthetic_data()

    X = data[['order_size', 'stock_ratio', 'concurrent_requests', 'warehouse_load']]
    y = data['latency_ms']

    print("[2/4] Splitting data: 70% Training / 30% Testing...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, random_state=42
    )

    print(f"      Training set: {len(X_train)} samples")
    print(f"      Testing set:  {len(X_test)} samples")

    print("[3/4] Training Random Forest Regressor...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    r2 = r2_score(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))

    print(f"[4/4] Model Evaluation Results:")
    print(f"      R² Score: {r2:.4f}")
    print(f"      RMSE: {rmse:.2f} ms")

    joblib.dump(model, 'bottleneck_model.joblib')
    print("✓ Model successfully saved to 'bottleneck_model.joblib'")

if __name__ == '__main__':
    train_bottleneck_model()