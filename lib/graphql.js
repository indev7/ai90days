/**
 * GraphQL utility for fetching data from WordPress CMS
 */

const GRAPHQL_ENDPOINT = 'https://cms.intervest.lk/graphql';

/**
 * Fetch daily inspirations from WordPress GraphQL API
 * @returns {Promise<Array>} Array of daily inspiration nodes
 */
export async function fetchDailyInspirations() {
  const query = `
    query getDailyInspirations {
      dailyInspirations {
        nodes {
          id
          title
          dailyInspirations {
            backgroundImage {
              node {
                sourceUrl
                mediaDetails {
                  sizes {
                    name
                    sourceUrl
                  }
                }
              }
            }
            shortContent
            longContent
            category
            type
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      // Cache for 1 hour to avoid excessive API calls
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query returned errors');
    }

    return data.data?.dailyInspirations?.nodes || [];
  } catch (error) {
    console.error('Error fetching daily inspirations:', error);
    return [];
  }
}

/**
 * Get a random daily inspiration from the list
 * @param {Array} inspirations - Array of inspiration nodes
 * @returns {Object|null} Random inspiration or null if empty
 */
export function getRandomInspiration(inspirations) {
  if (!inspirations || inspirations.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * inspirations.length);
  return inspirations[randomIndex];
}

/**
 * Get the best available image URL from the background image node
 * @param {Object} backgroundImage - Background image object from GraphQL
 * @returns {string|null} Image URL or null
 */
export function getImageUrl(backgroundImage) {
  if (!backgroundImage?.node) {
    return null;
  }

  // Try to get a medium or large size first, fallback to sourceUrl
  const sizes = backgroundImage.node.mediaDetails?.sizes || [];
  const mediumSize = sizes.find(s => s.name === 'medium' || s.name === 'medium_large');
  const largeSize = sizes.find(s => s.name === 'large');
  
  return largeSize?.sourceUrl || mediumSize?.sourceUrl || backgroundImage.node.sourceUrl;
}