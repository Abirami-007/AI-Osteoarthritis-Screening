import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { calculateBMI, getBMICategory, getBMICategoryLabel } from '../utils/helpers';
import { ClipboardList } from 'lucide-react';

export default function PatientQuestionnaire() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    height: '',
    weight: '',
    painScore: 0,
    stiffness: '',
    previousKneeInjury: '',
    physicalActivity: '',
    difficultyWalking: '',
    difficultyClimbingStairs: '',
  });
  const [errors, setErrors] = useState({});

  const bmi = useMemo(() => calculateBMI(form.weight, form.height), [form.weight, form.height]);
  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);
  const bmiCategoryLabel = useMemo(() => getBMICategoryLabel(bmi), [bmi]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.height || form.height < 50 || form.height > 250) e.height = 'Enter valid height (50-250 cm)';
    if (!form.weight || form.weight < 10 || form.weight > 300) e.weight = 'Enter valid weight (10-300 kg)';
    if (!form.stiffness) e.stiffness = 'Select stiffness level';
    if (!form.previousKneeInjury) e.previousKneeInjury = 'Select an option';
    if (!form.physicalActivity) e.physicalActivity = 'Select activity level';
    if (!form.difficultyWalking) e.difficultyWalking = 'Select an option';
    if (!form.difficultyClimbingStairs) e.difficultyClimbingStairs = 'Select an option';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    dispatch({
      type: 'SET_QUESTIONNAIRE',
      payload: {
        ...form,
        patientId: state.patient?.patientId,
        age: state.patient?.age,
        bmi,
        bmiCategory,
      },
    });
    navigate('/connect-device');
  };

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <ClipboardList />
          </div>
          <h1 className="page-title">Patient Questionnaire</h1>
          <p className="page-description">
            Complete the clinical assessment for {state.patient?.name || 'the patient'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} id="questionnaire-form">
            {/* Patient ID - Read Only */}
            <div className="form-group">
              <label className="form-label" htmlFor="q-patient-id">Patient ID</label>
              <input
                id="q-patient-id"
                type="text"
                className="form-input"
                value={state.patient?.patientId || ''}
                disabled
              />
            </div>

            {/* Age - Read Only */}
            <div className="form-group">
              <label className="form-label" htmlFor="q-age">Age</label>
              <input
                id="q-age"
                type="text"
                className="form-input"
                value={state.patient?.age ? `${state.patient.age} years` : ''}
                disabled
              />
            </div>

            {/* Height & Weight */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="q-height">
                  Height (cm) <span className="required">*</span>
                </label>
                <input
                  id="q-height"
                  type="number"
                  className={`form-input ${errors.height ? 'error' : ''}`}
                  placeholder="e.g., 165"
                  value={form.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  min="50"
                  max="250"
                />
                {errors.height && <p className="form-error">{errors.height}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="q-weight">
                  Weight (kg) <span className="required">*</span>
                </label>
                <input
                  id="q-weight"
                  type="number"
                  className={`form-input ${errors.weight ? 'error' : ''}`}
                  placeholder="e.g., 70"
                  value={form.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  min="10"
                  max="300"
                />
                {errors.weight && <p className="form-error">{errors.weight}</p>}
              </div>
            </div>

            {/* BMI Auto-calc */}
            {bmi && (
              <div className="bmi-display">
                <div>
                  <div className="bmi-label">Calculated BMI</div>
                  <div className="bmi-value">{bmi}</div>
                </div>
                <span className={`bmi-category ${bmiCategory}`}>{bmiCategoryLabel}</span>
              </div>
            )}

            {/* Pain Score */}
            <div className="form-group">
              <label className="form-label" htmlFor="q-pain-score">
                Pain Score (0 = No Pain, 10 = Worst Pain)
              </label>
              <div className="form-range-container">
                <input
                  id="q-pain-score"
                  type="range"
                  className="form-range"
                  min="0"
                  max="10"
                  value={form.painScore}
                  onChange={(e) => handleChange('painScore', parseInt(e.target.value))}
                />
                <span className="form-range-value">{form.painScore}</span>
              </div>
            </div>

            {/* Stiffness */}
            <div className="form-group">
              <label className="form-label">
                Stiffness <span className="required">*</span>
              </label>
              <div className="form-toggle-group">
                {['None', 'Mild', 'Moderate', 'Severe'].map((opt) => (
                  <div className="form-toggle-option" key={opt}>
                    <input
                      type="radio"
                      name="stiffness"
                      id={`stiffness-${opt}`}
                      value={opt}
                      checked={form.stiffness === opt}
                      onChange={(e) => handleChange('stiffness', e.target.value)}
                    />
                    <label className="form-toggle-label" htmlFor={`stiffness-${opt}`}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {errors.stiffness && <p className="form-error">{errors.stiffness}</p>}
            </div>

            {/* Previous Knee Injury */}
            <div className="form-group">
              <label className="form-label">
                Previous Knee Injury <span className="required">*</span>
              </label>
              <div className="form-toggle-group">
                {['Yes', 'No'].map((opt) => (
                  <div className="form-toggle-option" key={opt}>
                    <input
                      type="radio"
                      name="previousKneeInjury"
                      id={`injury-${opt}`}
                      value={opt}
                      checked={form.previousKneeInjury === opt}
                      onChange={(e) => handleChange('previousKneeInjury', e.target.value)}
                    />
                    <label className="form-toggle-label" htmlFor={`injury-${opt}`}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {errors.previousKneeInjury && <p className="form-error">{errors.previousKneeInjury}</p>}
            </div>

            {/* Physical Activity */}
            <div className="form-group">
              <label className="form-label">
                Physical Activity Level <span className="required">*</span>
              </label>
              <div className="form-toggle-group">
                {['Low', 'Moderate', 'High'].map((opt) => (
                  <div className="form-toggle-option" key={opt}>
                    <input
                      type="radio"
                      name="physicalActivity"
                      id={`activity-${opt}`}
                      value={opt}
                      checked={form.physicalActivity === opt}
                      onChange={(e) => handleChange('physicalActivity', e.target.value)}
                    />
                    <label className="form-toggle-label" htmlFor={`activity-${opt}`}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {errors.physicalActivity && <p className="form-error">{errors.physicalActivity}</p>}
            </div>

            {/* Difficulty Walking */}
            <div className="form-group">
              <label className="form-label">
                Difficulty Walking <span className="required">*</span>
              </label>
              <div className="form-toggle-group">
                {['Yes', 'No'].map((opt) => (
                  <div className="form-toggle-option" key={opt}>
                    <input
                      type="radio"
                      name="difficultyWalking"
                      id={`walking-${opt}`}
                      value={opt}
                      checked={form.difficultyWalking === opt}
                      onChange={(e) => handleChange('difficultyWalking', e.target.value)}
                    />
                    <label className="form-toggle-label" htmlFor={`walking-${opt}`}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {errors.difficultyWalking && <p className="form-error">{errors.difficultyWalking}</p>}
            </div>

            {/* Difficulty Climbing Stairs */}
            <div className="form-group">
              <label className="form-label">
                Difficulty Climbing Stairs <span className="required">*</span>
              </label>
              <div className="form-toggle-group">
                {['Yes', 'No'].map((opt) => (
                  <div className="form-toggle-option" key={opt}>
                    <input
                      type="radio"
                      name="difficultyClimbingStairs"
                      id={`stairs-${opt}`}
                      value={opt}
                      checked={form.difficultyClimbingStairs === opt}
                      onChange={(e) => handleChange('difficultyClimbingStairs', e.target.value)}
                    />
                    <label className="form-toggle-label" htmlFor={`stairs-${opt}`}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {errors.difficultyClimbingStairs && <p className="form-error">{errors.difficultyClimbingStairs}</p>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full mt-6"
              id="questionnaire-submit-btn"
            >
              Continue to Device Connection
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
