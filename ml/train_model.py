"""Train and export the local ACADlytics academic early-warning model.

Creates a separate synthetic historical sample for model development. It never
overwrites data/student_grades.csv and never uses final grades as model inputs.
"""
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FEATURES = ("attendance_pct", "quiz_average", "assignment_average", "midterm_score", "previous_gpa", "missing_submissions")
HIGH_THRESHOLD = 0.50
MODERATE_THRESHOLD = 0.20
MODEL_VERSION = "acadlytics_midterm_failure_v2"
RANDOM_STATE = 42


def bounded(values, low=0.0, high=100.0):
    return np.clip(values, low, high).round(1)


def make_synthetic_dataset(path: Path, rows_count: int = 1500) -> list[dict[str, str]]:
    """Create reproducible synthetic historical records with pre-final features."""
    rng = np.random.default_rng(RANDOM_STATE)
    subjects = [("IT301", "Object-Oriented Programming"), ("IT302", "Database Management Systems"), ("IT303", "Web Systems and Technologies"), ("IT401", "Information Assurance and Security")]
    years = ["2023-2024", "2024-2025", "2025-2026", "2026-2027"]
    records = []
    for index in range(rows_count):
        latent = float(rng.normal(0, 1))
        attendance = float(bounded(87 - latent * 10 + rng.normal(0, 6), 45, 100))
        quiz = float(bounded(84 - latent * 9 + rng.normal(0, 7), 40, 100))
        assignment = float(bounded(85 - latent * 8 + rng.normal(0, 7), 35, 100))
        midterm = float(bounded(83 - latent * 11 + rng.normal(0, 8), 35, 100))
        previous_gpa = float(bounded(2.05 + latent * 0.45 + rng.normal(0, 0.22), 1.0, 3.8))
        missing = int(np.clip(round(1.0 + latent * 1.2 + rng.normal(0, 1.0)), 0, 6))
        risk_signal = 0.035 * (75 - attendance) + 0.025 * (75 - quiz) + 0.022 * (75 - assignment) + 0.030 * (75 - midterm) + 0.9 * (previous_gpa - 2.6) + 0.34 * missing + rng.normal(0, 0.8)
        failed = risk_signal > 1.65
        final_grade = float(np.clip(2.0 + 0.021 * (85 - attendance) + 0.018 * (85 - quiz) + 0.019 * (85 - assignment) + 0.024 * (85 - midterm) + 0.22 * missing + rng.normal(0, 0.18), 1.0, 5.0))
        final_grade = float(np.clip(max(final_grade, 4.0 + rng.normal(0, 0.25)), 4.0, 5.0) if failed else np.clip(min(final_grade, 3.0 - abs(rng.normal(0, 0.25))), 1.0, 3.0))
        subject_code, subject_name = subjects[index % len(subjects)]
        year_level = 2 + (index % 3)
        records.append({
            "record_id": f"SYN-{index + 1:05d}", "student_id": f"SYN-STU-{(index % 500) + 1:04d}",
            "academic_year": years[index % len(years)], "semester": "1st Semester" if (index // len(years)) % 2 == 0 else "2nd Semester",
            "year_level": str(year_level), "section": f"BSIT-{year_level}{chr(65 + (index % 4))}",
            "subject_code": subject_code, "subject_name": subject_name,
            "attendance_pct": f"{attendance:.1f}", "quiz_average": f"{quiz:.1f}", "assignment_average": f"{assignment:.1f}",
            "midterm_score": f"{midterm:.1f}", "previous_gpa": f"{previous_gpa:.2f}", "missing_submissions": str(missing),
            "final_grade": f"{final_grade:.2f}", "passed": "0" if failed else "1", "dataset_type": "Synthetic historical training record",
        })
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=list(records[0]))
        writer.writeheader(); writer.writerows(records)
    return records


def load_dashboard_rows(path: Path, feature_names):
    with path.open("r", newline="", encoding="utf-8-sig") as fp:
        rows = list(csv.DictReader(fp))
    required = {"record_id", *feature_names}
    missing = required - set(rows[0])
    if missing:
        raise SystemExit(f"Dashboard CSV is missing compatible features: {', '.join(sorted(missing))}")
    if len({row["record_id"] for row in rows}) != len(rows):
        raise SystemExit("Duplicate record_id found in dashboard data.")
    try:
        matrix = np.asarray([[float(row[name]) for name in feature_names] for row in rows], dtype=float)
    except (ValueError, TypeError) as exc:
        raise SystemExit(f"Invalid dashboard feature value: {exc}") from exc
    if not np.isfinite(matrix).all():
        raise SystemExit("Dashboard features contain missing or infinite values.")
    return rows, matrix


def model_candidates():
    return {
        "Logistic Regression": make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=3000, random_state=RANDOM_STATE)),
        "Random Forest": RandomForestClassifier(n_estimators=350, min_samples_leaf=3, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1),
    }


def evaluate(y_true, scores):
    labels = (scores >= HIGH_THRESHOLD).astype(int)
    matrix = confusion_matrix(y_true, labels, labels=[0, 1])
    return {"tested_records": int(len(y_true)), "actual_failures": int(y_true.sum()), "accuracy": round(float(accuracy_score(y_true, labels)), 4), "precision": round(float(precision_score(y_true, labels, zero_division=0)), 4), "recall": round(float(recall_score(y_true, labels, zero_division=0)), 4), "f1": round(float(f1_score(y_true, labels, zero_division=0)), 4), "roc_auc": round(float(roc_auc_score(y_true, scores)), 4), "confusion_matrix": matrix.tolist()}


def risk_level(score: float) -> str:
    return "High Failure Risk" if score >= HIGH_THRESHOLD else "Moderate Failure Risk" if score >= MODERATE_THRESHOLD else "Low Failure Risk"


def export_predictions(rows, scores, path: Path):
    headers = ["record_id", "student_id", "faculty_id", "assignment_id", "academic_year", "semester", "year_level", "section", "subject_code", "subject_name", "failure_risk_score_pct", "predicted_risk_level", "screening_point", "prediction_type", "model_version"]
    with path.open("w", newline="", encoding="utf-8-sig") as fp:
        writer = csv.DictWriter(fp, fieldnames=headers); writer.writeheader()
        for row, score in zip(rows, scores):
            output = {key: row.get(key, "") for key in headers}
            output.update({"failure_risk_score_pct": f"{score * 100:.1f}", "predicted_risk_level": risk_level(float(score)), "screening_point": "After midterm", "prediction_type": "Historical retrospective screening; final grade excluded from inputs", "model_version": MODEL_VERSION})
            writer.writerow(output)


def main():
    parser = argparse.ArgumentParser(description="Train the local ACADlytics failure-risk model")
    parser.add_argument("--synthetic-rows", type=int, default=1500)
    parser.add_argument("--dashboard-input", default=str(PROJECT_ROOT / "data" / "student_grades.csv"))
    parser.add_argument("--synthetic-output", default=str(PROJECT_ROOT / "data" / "synthetic_historical_training.csv"))
    parser.add_argument("--model", default=str(PROJECT_ROOT / "ml" / "risk_model.joblib"))
    parser.add_argument("--predictions", default=str(PROJECT_ROOT / "data" / "risk_predictions.csv"))
    parser.add_argument("--metrics", default=str(PROJECT_ROOT / "ml" / "training_metrics.json"))
    args = parser.parse_args()
    if not 1000 <= args.synthetic_rows <= 2000:
        raise SystemExit("--synthetic-rows must be between 1000 and 2000")
    training_rows = make_synthetic_dataset(Path(args.synthetic_output), args.synthetic_rows)
    X = np.asarray([[float(row[name]) for name in FEATURES] for row in training_rows], dtype=float)
    y = np.asarray([1 - int(row["passed"]) for row in training_rows], dtype=int)
    train_idx, test_idx = train_test_split(np.arange(len(training_rows)), test_size=0.25, stratify=y, random_state=RANDOM_STATE)
    candidates = model_candidates(); holdout_metrics = {}; cv_metrics = {}
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    for name, candidate in candidates.items():
        candidate.fit(X[train_idx], y[train_idx])
        holdout_metrics[name] = evaluate(y[test_idx], candidate.predict_proba(X[test_idx])[:, 1])
        oof_scores = cross_val_predict(candidate, X, y, cv=cv, method="predict_proba")[:, 1]
        cv_metrics[name] = evaluate(y, oof_scores)
    selected_name = max(cv_metrics, key=lambda name: (cv_metrics[name]["f1"], cv_metrics[name]["recall"]))
    selected_model = candidates[selected_name]; selected_model.fit(X, y)
    with Path(args.dashboard_input).open("r", newline="", encoding="utf-8-sig") as fp:
        dashboard_headers = set(csv.DictReader(fp).fieldnames or [])
    dashboard_features = tuple(name for name in FEATURES if name in dashboard_headers)
    if len(dashboard_features) < 3:
        raise SystemExit("Dashboard data must contain at least three pre-final numeric features for compatible scoring.")
    dashboard_rows, dashboard_matrix = load_dashboard_rows(Path(args.dashboard_input), dashboard_features)
    compatible_X = np.asarray([[float(row[name]) for name in dashboard_features] for row in training_rows], dtype=float)
    compatible_candidates = model_candidates()
    compatible_cv_metrics = {}
    for name, candidate in compatible_candidates.items():
        compatible_scores = cross_val_predict(candidate, compatible_X, y, cv=cv, method="predict_proba")[:, 1]
        compatible_cv_metrics[name] = evaluate(y, compatible_scores)
    compatible_name = max(compatible_cv_metrics, key=lambda name: (compatible_cv_metrics[name]["f1"], compatible_cv_metrics[name]["recall"]))
    compatible_model = compatible_candidates[compatible_name]
    compatible_model.fit(compatible_X, y)
    dashboard_scores = compatible_model.predict_proba(dashboard_matrix)[:, 1]
    model_path = Path(args.model); model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": compatible_model, "features": dashboard_features, "model_version": MODEL_VERSION, "selected_model": compatible_name, "full_training_model": selected_name, "thresholds": {"high": HIGH_THRESHOLD, "moderate": MODERATE_THRESHOLD}, "training_rows": len(training_rows), "synthetic_training_data": True}, model_path)
    predictions_path = Path(args.predictions); predictions_path.parent.mkdir(parents=True, exist_ok=True); export_predictions(dashboard_rows, dashboard_scores, predictions_path)
    report = {"model_version": MODEL_VERSION, "generated_utc": datetime.now(timezone.utc).isoformat(), "dataset": "SYNTHETIC HISTORICAL TRAINING DATASET", "synthetic_training_file": str(Path(args.synthetic_output).relative_to(PROJECT_ROOT)), "row_count": len(training_rows), "failure_count": int(y.sum()), "not_failed_count": int((y == 0).sum()), "input_features_used_before_final_grade": list(FEATURES), "dashboard_compatible_features": list(dashboard_features), "features_excluded_for_leakage": ["final_grade", "passed", "grade_status", "final_exam_score"], "validation": {"method": "Stratified 75/25 holdout plus 5-fold stratified out-of-fold comparison", "holdout_train_count": int(len(train_idx)), "holdout_test_count": int(len(test_idx)), "holdout_metrics_by_model": holdout_metrics, "cross_validation_metrics_by_model": cv_metrics, "dashboard_compatible_cross_validation_metrics": compatible_cv_metrics}, "selected_model": selected_name, "dashboard_selected_model": compatible_name, "prediction_output_records": len(dashboard_rows), "prediction_source": "Existing data/student_grades.csv; matched by record_id; final grade was not used as an input", "risk_thresholds": "High >=50%, Moderate 20%-<50%, Low <20%; screening scores are not guaranteed probabilities", "limitation": "The dashboard records already contain final grades, so these are historical retrospective screenings for demonstration and faculty review, not verified future-semester forecasts."}
    metrics_path = Path(args.metrics); metrics_path.parent.mkdir(parents=True, exist_ok=True); metrics_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\n=== ACADlytics Local ML Training Completed ===")
    print(f"Synthetic records: {len(training_rows)} | Failures: {int(y.sum())} | Not failed: {int((y == 0).sum())}")
    for name in candidates:
        metric = cv_metrics[name]; print(f"{name} 5-fold OOF: accuracy={metric['accuracy']:.1%}, precision={metric['precision']:.1%}, recall={metric['recall']:.1%}, F1={metric['f1']:.1%}")
    print(f"Selected full-feature model: {selected_name}"); print(f"Dashboard-compatible model: {compatible_name} using {', '.join(dashboard_features)}"); print(f"Dashboard predictions: {len(dashboard_rows)} records -> {predictions_path}"); print(f"Model: {model_path}"); print(f"Metrics: {metrics_path}")
    print("Note: existing dashboard records have final grades; exported scores are retrospective screening estimates.")


if __name__ == "__main__":
    main()
