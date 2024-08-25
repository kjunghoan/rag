import Home from '@/app/page';
import { render, screen } from '@testing-library/react';

describe('Home', () => {
  it('should render without crashing', () => {
    render(<Home />);
    const homepage = screen.getByTestId('homepage');
    expect(homepage).toBeInTheDocument();
  });
});

