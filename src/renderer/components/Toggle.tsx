import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  className?: string;
  'data-testid'?: string;
  [key: string]: any; // For any additional data attributes
}

const Toggle: React.FC<ToggleProps> = ({ 
  checked, 
  onChange, 
  disabled = false,
  variant = 'default',
  className = '',
  ...props 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e.target.checked);
    }
  };

  const toggleClass = variant === 'danger' ? 'toggle-switch skip-toggle' : 'toggle-switch';
  const fullClassName = `${toggleClass} ${className}`.trim();

  return (
    <label className={fullClassName}>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        {...props}
      />
      <span className="slider"></span>
    </label>
  );
};

export default Toggle;