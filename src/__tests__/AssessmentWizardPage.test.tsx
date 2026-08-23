import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssessmentWizardPage } from '../pages/AssessmentWizardPage';
import { TooltipProvider } from '../components/ui/tooltip';
import { doc } from 'firebase/firestore';

const createCampaignMock = vi.fn();
const createAssessmentLinkMock = vi.fn();
const getDocMock = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: (_functions: any, name: string) => {
    if (name === 'createCampaign') return createCampaignMock;
    if (name === 'createAssessmentLink') return createAssessmentLinkMock;
    return vi.fn();
  },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: (...args: any[]) => getDocMock(...args),
}));

describe('AssessmentWizardPage', () => {
  beforeEach(() => {
    createCampaignMock.mockReset();
    createAssessmentLinkMock.mockReset();
    getDocMock.mockReset();
    vi.mocked(doc).mockClear();
    
    // Set a high balance for most tests
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ credits: 10 }),
    });
    
    // Set a default identity for tests to prevent early returns
    localStorage.setItem('presift_uid', 'default-test-uid');
  });

  it('reads the recruiter balance for the presift_uid in localStorage', async () => {
    localStorage.setItem('presift_uid', 'wizard-uid-1');
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'wizard-uid-1');
    });
    expect(doc).not.toHaveBeenCalledWith(expect.anything(), 'users', 'demo_recruiter');
  });

  it('aborts fetch when no presift_uid is set', async () => {
    localStorage.removeItem('presift_uid');
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(doc).not.toHaveBeenCalled();
    });
    expect(doc).not.toHaveBeenCalledWith(expect.anything(), 'users', 'demo_recruiter');
  });

  it('validates Step 1 and requires positionTitle', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    expect(nextBtn).toBeDisabled();

    const positionInput = screen.getByLabelText(/Position Title/i);
    fireEvent.change(positionInput, { target: { value: 'Backend Engineer' } });

    expect(nextBtn).not.toBeDisabled();
    
    // Move to step 2
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step 2: Select Modules/i)).toBeTruthy();
  });

  it('validates Step 2 and requires at least one module', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Step 1
    fireEvent.change(screen.getByLabelText(/Position Title/i), { target: { value: 'QA Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    // Step 2
    expect(screen.getByText(/1 Credit \/ Candidate/i)).toBeTruthy();
    
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    expect(nextBtn).not.toBeDisabled(); // ICAR-16 is checked by default

    // Uncheck ICAR-16
    const icarCheck = screen.getByLabelText(/ICAR-16/i);
    fireEvent.click(icarCheck);
    
    expect(nextBtn).toBeDisabled(); // Now none are checked

    // Check WLEIS-16
    const wleisCheck = screen.getByLabelText(/WLEIS-16/i);
    fireEvent.click(wleisCheck);

    expect(nextBtn).not.toBeDisabled();
    
    // Move to step 3
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step 3: Dispatch Candidates/i)).toBeTruthy();
  });

  it('allows adding candidates and blocks submission if balance is insufficient', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ credits: 1 }), // Only 1 credit
    });

    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Skip to step 3
    fireEvent.change(screen.getByLabelText(/Position Title/i), { target: { value: 'Test Role' } });
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    const addBtn = screen.getByRole('button', { name: /Add Another Candidate/i });
    const submitBtn = screen.getByRole('button', { name: /Create Campaign & Links/i });

    // Wait for balance to load
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });

    // Add another candidate
    fireEvent.click(addBtn);

    // Now 2 candidates, cost 2, balance 1 -> blocked
    expect(screen.getByText(/Insufficient Credits/i)).toBeTruthy();
    expect(submitBtn).toBeDisabled();
  });

  it('successfully creates campaign and assessment links on submission', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AssessmentWizardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Skip to step 3
    fireEvent.change(screen.getByLabelText(/Position Title/i), { target: { value: 'Frontend Developer' } });
    fireEvent.change(screen.getByLabelText(/Department/i), { target: { value: 'Engineering' } });
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));
    
    // Default modules (ICAR) is fine
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    const nameInputs = screen.getAllByPlaceholderText('Name');
    const emailInputs = screen.getAllByPlaceholderText('Email');
    
    fireEvent.change(nameInputs[0], { target: { value: 'Alice Smith' } });
    fireEvent.change(emailInputs[0], { target: { value: 'alice@example.com' } });

    createCampaignMock.mockResolvedValue({ data: { id: 'camp_123' } });
    createAssessmentLinkMock.mockResolvedValue({ data: { url: 'http://localhost/assessment/cand_456' } });

    const submitBtn = screen.getByRole('button', { name: /Create Campaign & Links/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createCampaignMock).toHaveBeenCalledWith({
        positionTitle: 'Frontend Developer',
        department: 'Engineering',
        moduleIds: ['icar16'],
      });
      expect(createAssessmentLinkMock).toHaveBeenCalledWith({
        roleTitle: 'Frontend Developer',
        candidateName: 'Alice Smith',
        candidateEmail: 'alice@example.com',
        campaignId: 'camp_123',
      });
    });

    // Step 4 (Success)
    expect(screen.getByText(/Campaign Created Successfully!/i)).toBeTruthy();
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByDisplayValue('http://localhost/assessment/cand_456')).toBeTruthy();
  });
});
