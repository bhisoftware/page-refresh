"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches errors in the layout section (e.g. malformed layout HTML breaking iframe,
 * or bad data shape). Prevents one bad layout from crashing the whole results page.
 */
export class LayoutSectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mb-10 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-6">
          <h2 className="text-xl font-semibold mb-2">Choose a layout</h2>
          <p className="text-muted-foreground">
            One or more layout previews could not be displayed. Your scores and
            other results are still valid—you can use the download option from
            the home page or try running the refresh again.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}
