import { Link, LinkProps, useLocation } from 'react-router-dom';
import { cn } from '@/core/utils/utils';

interface NavLinkProps extends Omit<LinkProps, 'className' | 'children'> {
  activeClassName?: string;
  end?: boolean;
  className?: string | ((props: { isActive: boolean }) => string);
  children?: React.ReactNode | ((props: { isActive: boolean }) => React.ReactNode);
}

export function NavLink({
  to,
  className,
  activeClassName = 'bg-accent text-accent-foreground',
  end = false,
  children,
  ...props
}: NavLinkProps) {
  const location = useLocation();
  const isActive = end
    ? location.pathname === to
    : location.pathname.startsWith(to as string);

  const resolvedClassName = typeof className === 'function'
    ? className({ isActive })
    : cn(className, isActive && activeClassName);

  return (
    <Link
      to={to}
      className={resolvedClassName}
      {...props}
    >
      {typeof children === 'function' ? children({ isActive }) : children}
    </Link>
  );
}
