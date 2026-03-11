/**
 * Layout & Component CSS Classes Guide
 * 
 * Type definitions and documentation for CSS classes
 * used throughout the admin dashboard application.
 */

// ============================================
// DASHBOARD STATS CARDS
// ============================================

interface StatCardProps {
  /** Container with grid layout */
  'dashboard-stats': string;
  /** Individual stat card */
  'stat-card': string;
  /** Card title (uppercase) */
  'stat-card-title': string;
  /** Large number value */
  'stat-card-value': string;
  /** Metadata/description */
  'stat-card-meta': string;
}

// ============================================
// FORM COMPONENTS
// ============================================

interface FormProps {
  /** Container for form groups */
  'form-container': string;
  /** Individual form input group */
  'form-group': string;
  /** Form group label */
  'form-group-label': string;
}

// ============================================
// DATA TABLES
// ============================================

interface TableProps {
  /** Wrapper with rounded corners */
  'data-table-wrapper': string;
  /** Table element */
  'data-table': string;
  /** Container for action buttons */
  'action-buttons': string;
  /** Individual action button */
  'action-btn': string;
  /** Edit action button variant */
  'action-btn edit': string;
  /** Delete action button variant */
  'action-btn delete': string;
}

// ============================================
// LISTS
// ============================================

interface ListProps {
  /** List container */
  'list-container': string;
  /** Individual list item */
  'list-item-modern': string;
}

// ============================================
// BADGES & STATUS
// ============================================

interface BadgeProps {
  /** Badge element */
  'badge': string;
  /** Active status badge (green) */
  'badge status-active': string;
  /** Inactive status badge (gray) */
  'badge status-inactive': string;
  /** Pending status badge (amber) */
  'badge status-pending': string;
}

// ============================================
// MODALS & DIALOGS
// ============================================

interface ModalProps {
  /** Modal background overlay */
  'modal-overlay': string;
  /** Modal dialog container */
  'modal-dialog': string;
  /** Modal header */
  'modal-header': string;
  /** Modal body content */
  'modal-body': string;
  /** Modal footer with buttons */
  'modal-footer': string;
}

// ============================================
// TABS
// ============================================

interface TabProps {
  /** Tabs container */
  'tabs-container': string;
  /** Individual tab button */
  'tab-button': string;
  /** Active tab button */
  'tab-button active': string;
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

interface AlertProps {
  /** Alert message container */
  'alert': string;
  /** Success alert (green) */
  'alert success': string;
  /** Error alert (red) */
  'alert error': string;
  /** Warning alert (amber) */
  'alert warning': string;
  /** Info alert (cyan) */
  'alert info': string;
}

// ============================================
// SECTION HEADERS
// ============================================

interface SectionProps {
  /** Section header container */
  'section-header': string;
}

// ============================================
// LOADING STATES
// ============================================

interface LoadingProps {
  /** Loading container */
  'loading-container': string;
  /** Animated spinner */
  'loading-spinner-modern': string;
  /** Loading text */
  'loading-text': string;
}

// ============================================
// EMPTY STATES
// ============================================

interface EmptyStateProps {
  /** Empty state container */
  'empty-state': string;
  /** Icon area */
  'empty-state-icon': string;
}

// ============================================
// GRID SYSTEM
// ============================================

interface GridProps {
  /** Row container (flex wrapper) */
  'row': string;
  /** 50% width column (responsive) */
  'col-md-6': string;
  /** 33.33% width column (responsive) */
  'col-md-4': string;
  /** 25% width column (responsive) */
  'col-md-3': string;
  /** Card grid with auto-fit */
  'cards-grid': string;
}

// ============================================
// BUTTONS
// ============================================

interface ButtonProps {
  /** Primary button */
  'btn': string;
  /** Secondary button (green outline) */
  'btn secondary': string;
  /** Danger button (red) */
  'btn danger': string;
  /** Success button (green) */
  'btn success': string;
}

// ============================================
// BASIC ELEMENTS
// ============================================

interface BasicProps {
  /** Card/Container */
  'card': string;
  /** Settings container */
  'settings-container': string;
  /** Table container */
  'table-container': string;
  /** White glass card */
  'white-glass-card': string;
}

// ============================================
// TEXT UTILITIES
// ============================================

interface TextProps {
  /** Success text color (green) */
  'text-success': string;
  /** Danger text color (red) */
  'text-danger': string;
  /** Warning text color (amber) */
  'text-warning': string;
  /** Info text color (cyan) */
  'text-info': string;
  /** Bold text */
  'fw-bold': string;
  /** Center aligned text */
  'text-center': string;
  /** Right aligned text */
  'text-right': string;
}

// ============================================
// SPACING UTILITIES
// ============================================

interface SpacingProps {
  /** Margin bottom 16px */
  'mb-4': string;
  /** Margin top 16px */
  'mt-4': string;
  /** Padding 16px */
  'p-4': string;
}

// ============================================
// COLOR VARIABLES (CSS Custom Properties)
// ============================================

interface ColorVariables {
  // Primary Colors
  '--primary': '#10b981'; // Main green
  '--primary-hover': '#059669'; // Darker green
  '--primary-light': '#6ee7b7'; // Light green
  
  // Accent Colors
  '--accent': '#34d399'; // Light green accent
  '--accent-dark': '#047857'; // Dark green accent
  
  // Background Colors
  '--bg-app': '#ffffff'; // Main background
  '--bg-panel': '#f0fdf4'; // Panel background
  '--bg-card': 'rgba(16, 185, 129, 0.05)'; // Card background
  
  // Text Colors
  '--text-main': '#064e3b'; // Primary text
  '--text-secondary': '#10b981'; // Secondary text
  
  // Border & Shadow
  '--border-color': 'rgba(16, 185, 129, 0.15)'; // Border color
  '--shadow-sm': '0 1px 2px 0 rgba(16, 185, 129, 0.08)'; // Small shadow
  '--shadow-md': '0 4px 6px -1px rgba(16, 185, 129, 0.12), 0 2px 4px -1px rgba(16, 185, 129, 0.08)'; // Medium shadow
  '--shadow-lg': '0 10px 15px -3px rgba(16, 185, 129, 0.15), 0 4px 6px -2px rgba(16, 185, 129, 0.1)'; // Large shadow
  
  // Layout
  '--radius': '12px'; // Border radius
  '--sidebar-width': '260px'; // Sidebar width
  '--header-height': '64px'; // Header height
}

// ============================================
// RESPONSIVE BREAKPOINTS
// ============================================

/**
 * Media Query Breakpoints
 * 
 * - Desktop: 1024px and up
 * - Tablet: 768px to 1023px
 * - Mobile: 480px to 767px
 * - Small Mobile: Below 480px
 */

// ============================================
// ANIMATION & TRANSITION TIMING
// ============================================

/**
 * Standard Easing: cubic-bezier(0.4, 0, 0.2, 1)
 * 
 * Durations:
 * - Fast: 0.2s (hover effects, quick interactions)
 * - Normal: 0.3s (form focus, tab changes)
 * - Slow: 0.5s (page load animations, modals)
 */

// ============================================
// REACT COMPONENT EXAMPLE USAGE
// ============================================

/**
 * Example React Component using Layout Classes
 * 
 * Apply these CSS classes in your React components to achieve
 * consistent styling throughout the admin dashboard.
 * 
 * @example
 * - Use 'dashboard-stats' container with 'stat-card' children
 * - Use 'data-table-wrapper' and 'data-table' for data display
 * - Use 'form-container' and 'form-group' for forms
 * - Use 'badge' classes for status indicators
 * - Use 'alert' and 'loading-container' for user feedback
 * - Use 'modal-*' classes for dialogs and overlays
 */

// ============================================
// EXPORT TYPES (Optional for TypeScript)
// ============================================

export type {
  StatCardProps,
  FormProps,
  TableProps,
  ListProps,
  BadgeProps,
  ModalProps,
  TabProps,
  AlertProps,
  SectionProps,
  LoadingProps,
  EmptyStateProps,
  GridProps,
  ButtonProps,
  BasicProps,
  TextProps,
  SpacingProps,
  ColorVariables,
};

export {};
