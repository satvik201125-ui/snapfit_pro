// Catch standard runtime errors
window.addEventListener('error', function(event) {
    const errorData = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : 'No stack trace'
    };
    
    console.warn('AI Error Monitor caught an error:', errorData);
    sendErrorToAI(errorData);
});

// Catch unhandled asynchronous promise rejections (e.g., failed API calls)
window.addEventListener('unhandledrejection', function(event) {
    const errorData = {
        message: event.reason ? event.reason.message : 'Unhandled Promise Rejection',
        stack: event.reason ? event.reason.stack : String(event.reason)
    };
    
    console.warn('AI Error Monitor caught a promise rejection:', errorData);
    sendErrorToAI(errorData);
});