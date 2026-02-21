import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PdfViewer from './PdfViewer.tsx';

afterEach(cleanup);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PdfViewer', () => {
  it('renders fileName in the header', () => {
    render(
      <PdfViewer
        fileName="Discharge_Summary.pdf"
        base64Content="JVBERi0xLjQ="
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Discharge_Summary.pdf')).toBeInTheDocument();
  });

  it('renders iframe when base64Content is provided', () => {
    render(
      <PdfViewer
        fileName="Report.pdf"
        base64Content="JVBERi0xLjQ="
        onClose={() => {}}
      />,
    );

    const iframe = screen.getByTitle('Report.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute(
      'src',
      'data:application/pdf;base64,JVBERi0xLjQ=',
    );
  });

  it('renders iframe when url is provided', () => {
    render(
      <PdfViewer
        fileName="ABG_Results.pdf"
        url="https://example.com/docs/abg.pdf"
        onClose={() => {}}
      />,
    );

    const iframe = screen.getByTitle('ABG_Results.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com/docs/abg.pdf');
  });

  it('prefers base64Content over url when both provided', () => {
    render(
      <PdfViewer
        fileName="Both.pdf"
        base64Content="JVBERi0xLjQ="
        url="https://example.com/fallback.pdf"
        onClose={() => {}}
      />,
    );

    const iframe = screen.getByTitle('Both.pdf');
    expect(iframe).toHaveAttribute(
      'src',
      'data:application/pdf;base64,JVBERi0xLjQ=',
    );
  });

  it('shows download button', () => {
    render(
      <PdfViewer
        fileName="Report.pdf"
        base64Content="JVBERi0xLjQ="
        onClose={() => {}}
      />,
    );

    const downloadLink = screen.getByText('Download');
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink.closest('a')).toHaveAttribute('download', 'Report.pdf');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PdfViewer
        fileName="Report.pdf"
        base64Content="JVBERi0xLjQ="
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByLabelText('Close PDF viewer');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render iframe when neither base64Content nor url provided', () => {
    render(
      <PdfViewer
        fileName="Empty.pdf"
        onClose={() => {}}
      />,
    );

    // The iframe should not be present because pdfSrc is empty string
    // and the component guards with `pdfSrc && (<iframe ...>)`
    expect(screen.queryByTitle('Empty.pdf')).not.toBeInTheDocument();
    // File name should still show in header
    expect(screen.getByText('Empty.pdf')).toBeInTheDocument();
  });
});
