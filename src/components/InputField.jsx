import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function InputField({ 
  label, 
  id, 
  type = 'text', 
  value, 
  onChange, 
  placeholder = '', 
  required = false,
  disabled = false,
  maxLength,
  icon: Icon
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="mb-4 relative">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-3.5 text-slate-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          id={id}
          type={currentType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-10 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
