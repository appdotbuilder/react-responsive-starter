import { type LandingPageContent } from '../schema';

export const getLandingPageContent = async (): Promise<LandingPageContent> => {
  try {
    // For now, return static content. This could be extended to fetch from database
    // when dynamic content management is needed
    const content: LandingPageContent = {
      title: 'Welcome to Our Amazing App',
      subtitle: 'Build faster, scale better, and deliver exceptional user experiences',
      features: [
        {
          title: 'Responsive Design',
          description: 'Beautiful interfaces that work seamlessly across all devices',
          icon: 'pi-mobile'
        },
        {
          title: 'Secure Authentication',
          description: 'Enterprise-grade security with modern authentication flows',
          icon: 'pi-shield'
        },
        {
          title: 'Real-time Dashboard',
          description: 'Monitor and manage your data with live updates and insights',
          icon: 'pi-chart-line'
        }
      ],
      call_to_action: {
        title: 'Ready to Get Started?',
        description: 'Join thousands of users who are already building amazing things',
        button_text: 'Sign Up Now'
      }
    };

    return content;
  } catch (error) {
    console.error('Failed to get landing page content:', error);
    throw error;
  }
};