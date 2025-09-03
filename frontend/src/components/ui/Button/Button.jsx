import React from 'react';
import PropTypes from 'prop-types';
import './Button.module.css';

/**
 * Reusable Button Component
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  className = '',
  type = 'button',
  onClick,
  ...rest
}) => {
  const baseClasses = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    disabled && 'button--disabled',
    loading && 'button--loading',
    className
  ].filter(Boolean).join(' ');

  const handleClick = (e) => {
    if (disabled || loading) return;
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={baseClasses}
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {loading && (
        <span className="button__spinner" aria-hidden="true">
          ●
        </span>
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span className="button__icon button__icon--left" aria-hidden="true">
          {icon}
        </span>
      )}

      {children && (
        <span className="button__content">
          {children}
        </span>
      )}

      {!loading && icon && iconPosition === 'right' && (
        <span className="button__icon button__icon--right" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost', 'link']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  onClick: PropTypes.func
};

export default Button;
