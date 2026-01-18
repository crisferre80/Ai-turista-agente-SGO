import React from 'react';

interface IconWrapperProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const IconWrapper = ({ children, className, style, ...rest }: IconWrapperProps) => (
  <span className={className} style={{ display: 'inline-block', width: 18, height: 18, lineHeight: '18px', textAlign: 'center', ...style }} {...rest}>
    {children}
  </span>
);

export const EnvelopeIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>✉️</IconWrapper>;
export const UserGroupIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>👥</IconWrapper>;
export const DocumentTextIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>📝</IconWrapper>;
export const PaperAirplaneIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>📤</IconWrapper>;
export const PlusIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>➕</IconWrapper>;
export const TrashIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>🗑️</IconWrapper>;
export const PencilIcon = (props?: React.HTMLAttributes<HTMLSpanElement>) => <IconWrapper {...props}>✏️</IconWrapper>;
