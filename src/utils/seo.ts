export const updateMetaTags = (data: {
    title: string;
    description: string;
    image?: string;
    url?: string;
}) => {
    // Update Title
    document.title = data.title;

    // Helper to set meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
        let element = document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${name}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(isProperty ? 'property' : 'name', name);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    // Standard Meta
    setMeta('description', data.description);

    // Open Graph / Facebook / WhatsApp
    setMeta('og:type', 'website', true);
    setMeta('og:title', data.title, true);
    setMeta('og:description', data.description, true);
    setMeta('og:site_name', 'Casamento.com', true); // Or configurable
    setMeta('og:locale', 'pt_BR', true);

    if (data.image) {
        setMeta('og:image', data.image, true);
        setMeta('twitter:image', data.image);
    }

    if (data.url) {
        setMeta('og:url', data.url, true);
    }

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', data.title);
    setMeta('twitter:description', data.description);
};
