async function sendErrorToAI(errorDetails) {
    try {
        const response = await fetch('/api/fix-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(errorDetails)
        });
        
        const result = await response.json();
        console.log('AI Suggested Fix:', result.patch);
    } catch (err) {
        console.error('Failed to communicate with AI error-fixing backend:', err);
    }
}