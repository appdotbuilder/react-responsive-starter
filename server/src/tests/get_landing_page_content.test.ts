import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { getLandingPageContent } from '../handlers/get_landing_page_content';
import { type LandingPageContent } from '../schema';

describe('getLandingPageContent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return landing page content with all required fields', async () => {
    const result = await getLandingPageContent();

    // Verify main structure
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('subtitle');
    expect(result).toHaveProperty('features');
    expect(result).toHaveProperty('call_to_action');

    // Verify title and subtitle are non-empty strings
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
    expect(typeof result.subtitle).toBe('string');
    expect(result.subtitle.length).toBeGreaterThan(0);
  });

  it('should return features array with correct structure', async () => {
    const result = await getLandingPageContent();

    // Verify features is an array
    expect(Array.isArray(result.features)).toBe(true);
    expect(result.features.length).toBeGreaterThan(0);

    // Verify each feature has required fields
    result.features.forEach(feature => {
      expect(feature).toHaveProperty('title');
      expect(feature).toHaveProperty('description');
      expect(feature).toHaveProperty('icon');
      
      expect(typeof feature.title).toBe('string');
      expect(feature.title.length).toBeGreaterThan(0);
      expect(typeof feature.description).toBe('string');
      expect(feature.description.length).toBeGreaterThan(0);
      expect(typeof feature.icon).toBe('string');
      expect(feature.icon.length).toBeGreaterThan(0);
    });
  });

  it('should return call to action with correct structure', async () => {
    const result = await getLandingPageContent();

    // Verify call_to_action structure
    expect(result.call_to_action).toHaveProperty('title');
    expect(result.call_to_action).toHaveProperty('description');
    expect(result.call_to_action).toHaveProperty('button_text');

    // Verify all CTA fields are non-empty strings
    expect(typeof result.call_to_action.title).toBe('string');
    expect(result.call_to_action.title.length).toBeGreaterThan(0);
    expect(typeof result.call_to_action.description).toBe('string');
    expect(result.call_to_action.description.length).toBeGreaterThan(0);
    expect(typeof result.call_to_action.button_text).toBe('string');
    expect(result.call_to_action.button_text.length).toBeGreaterThan(0);
  });

  it('should return consistent content across multiple calls', async () => {
    const result1 = await getLandingPageContent();
    const result2 = await getLandingPageContent();

    // Since this is static content, it should be identical
    expect(result1.title).toEqual(result2.title);
    expect(result1.subtitle).toEqual(result2.subtitle);
    expect(result1.features).toEqual(result2.features);
    expect(result1.call_to_action).toEqual(result2.call_to_action);
  });

  it('should return content that matches LandingPageContent schema', async () => {
    const result = await getLandingPageContent();

    // Verify the result structure matches expected schema
    const expectedStructure: LandingPageContent = {
      title: expect.any(String),
      subtitle: expect.any(String),
      features: expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          icon: expect.any(String)
        })
      ]),
      call_to_action: expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
        button_text: expect.any(String)
      })
    };

    expect(result).toMatchObject(expectedStructure);
  });

  it('should return specific expected content', async () => {
    const result = await getLandingPageContent();

    // Test specific content values
    expect(result.title).toBe('Welcome to Our Amazing App');
    expect(result.subtitle).toBe('Build faster, scale better, and deliver exceptional user experiences');
    
    // Test that we have exactly 3 features
    expect(result.features).toHaveLength(3);
    
    // Test feature titles
    const featureTitles = result.features.map(f => f.title);
    expect(featureTitles).toContain('Responsive Design');
    expect(featureTitles).toContain('Secure Authentication');
    expect(featureTitles).toContain('Real-time Dashboard');

    // Test CTA content
    expect(result.call_to_action.title).toBe('Ready to Get Started?');
    expect(result.call_to_action.button_text).toBe('Sign Up Now');
  });
});