import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { generatePatientId } from '../utils/helpers';
import { UserPlus } from 'lucide-react';

export default function RegisterPatient() {
  const { dispatch } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    patientId: generatePatientId(),
    name: '',
    age: '',
    gender: '',
    contact: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.age || form.age < 1 || form.age > 120) newErrors.age = 'Enter a valid age (1-120)';
    if (!form.gender) newErrors.gender = 'Select gender';
    if (!form.contact.trim()) newErrors.contact = 'Contact number is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    dispatch({ type: 'SET_PATIENT', payload: form });
    navigate('/questionnaire');
  };

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <UserPlus />
          </div>
          <h1 className="page-title">Register Patient</h1>
          <p className="page-description">
            Enter the patient&apos;s basic information to begin screening
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} id="register-form">
            <div className="form-group">
              <label className="form-label" htmlFor="patient-id">
                Patient ID
              </label>
              <input
                id="patient-id"
                type="text"
                className="form-input"
                value={form.patientId}
                disabled
              />
              <p className="form-hint">Auto-generated unique ID</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="patient-name">
                Full Name <span className="required">*</span>
              </label>
              <input
                id="patient-name"
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Enter patient's full name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                autoFocus
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="patient-age">
                  Age <span className="required">*</span>
                </label>
                <input
                  id="patient-age"
                  type="number"
                  className={`form-input ${errors.age ? 'error' : ''}`}
                  placeholder="Years"
                  value={form.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  min="1"
                  max="120"
                />
                {errors.age && <p className="form-error">{errors.age}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="patient-gender">
                  Gender <span className="required">*</span>
                </label>
                <select
                  id="patient-gender"
                  className={`form-select ${errors.gender ? 'error' : ''}`}
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <p className="form-error">{errors.gender}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="patient-contact">
                Contact Number <span className="required">*</span>
              </label>
              <input
                id="patient-contact"
                type="tel"
                className={`form-input ${errors.contact ? 'error' : ''}`}
                placeholder="Enter contact number"
                value={form.contact}
                onChange={(e) => handleChange('contact', e.target.value)}
              />
              {errors.contact && <p className="form-error">{errors.contact}</p>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full mt-4"
              id="register-submit-btn"
            >
              Continue to Questionnaire
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
