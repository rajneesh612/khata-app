import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import api from './api';

// Mock the API module
vi.mock('./api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Rahul' } }),
  }
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock shop in localStorage to bypass login screen
    localStorage.setItem('shop', JSON.stringify({ id: 1, name: 'Test Shop', owner: 'Test Owner' }));
  });

  it('renders Customer List heading', async () => {
    render(<App />);
    const heading = await screen.findByText(/Customer List/i);
    expect(heading).toBeInTheDocument();
  });

  it('should add a new customer when form is submitted', async () => {
    render(<App />);

    const nameInput = screen.getByPlaceholderText(/Customer name/i);
    const addButton = screen.getByText(/Add Customer/i);

    fireEvent.change(nameInput, { target: { value: 'Rahul' } });
    fireEvent.click(addButton);

    expect(api.post).toHaveBeenCalledWith('/customers', expect.objectContaining({
      name: 'Rahul'
    }));
  });

  it('should only allow numbers in phone field', async () => {
    render(<App />);

    const phoneInput = screen.getByPlaceholderText(/Phone/i);
    
    // Simulating typing alphabets and special characters
    fireEvent.change(phoneInput, { target: { value: '123abc#@!' } });

    // We expect the field to only contain the numbers if validation is working
    expect(phoneInput).toHaveValue('123');
  });

  it('should not allow adding a customer with same name and phone', async () => {
    // Mocking alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Pre-populating customers to simulate an existing one
    vi.mocked(api.get).mockResolvedValueOnce({ 
      data: [{ id: 1, name: 'Rahul', phone: '1234567890', address: null }] 
    });

    render(<App />);

    // Wait for customers to load
    await screen.findByText('Rahul');

    const nameInput = screen.getByPlaceholderText(/Customer name/i);
    const phoneInput = screen.getByPlaceholderText(/Phone/i);
    const addButton = screen.getByText(/Add Customer/i);

    // Try to add the same customer
    fireEvent.change(nameInput, { target: { value: 'Rahul' } });
    fireEvent.change(phoneInput, { target: { value: '1234567890' } });
    fireEvent.click(addButton);

    // Expect API NOT to be called because it's a duplicate
    expect(api.post).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/already exists/i));

    alertMock.mockRestore();
  });

  it('should not allow adding a customer with a phone number that already exists', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    vi.mocked(api.get).mockResolvedValueOnce({ 
      data: [{ id: 1, name: 'Rahul', phone: '1234567890', address: null }] 
    });

    render(<App />);
    await screen.findByText('Rahul');

    const nameInput = screen.getByPlaceholderText(/Customer name/i);
    const phoneInput = screen.getByPlaceholderText(/Phone/i);
    const addButton = screen.getByText(/Add Customer/i);

    // Different name, but same phone number
    fireEvent.change(nameInput, { target: { value: 'Suresh' } });
    fireEvent.change(phoneInput, { target: { value: '1234567890' } });
    fireEvent.click(addButton);

    expect(api.post).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/phone number already exists/i));

    alertMock.mockRestore();
  });
});
