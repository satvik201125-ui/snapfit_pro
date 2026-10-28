import React, { useState } from 'react';

export default function VirtualTryOnApp() {
  const [personFile, setPersonFile] = useState(null);
  const [garmentFile, setGarmentFile] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!personFile || !garmentFile) {
      alert("Please upload both a person photo and a garment image!");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("person_image", personFile);
    formData.append("garment_image", garmentFile);

    try {
      const response = await fetch("http://localhost:8000/api/virtual-try-on", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      if (response.ok) {
        setResultImage(data.result_image);
      } else {
        alert("Error: " + data.detail);
      }
    } catch (err) {
      console.error("Network error:", err);
      alert("Failed to connect to the AI server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>AI Virtual Try-On Studio</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label><strong>1. Upload Your Photo (Full-body or Upper-body):</strong></label>
          <input type="file" accept="image/*" onChange={(e) => setPersonFile(e.target.files[0])} />
        </div>

        <div>
          <label><strong>2. Upload Clothing Item:</strong></label>
          <input type="file" accept="image/*" onChange={(e) => setGarmentFile(e.target.files[0])} />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          {loading ? "Generating Outfit (Please wait)..." : "Try It On"}
        </button>
      </form>

      {resultImage && (
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h3>Result:</h3>
          <img src={resultImage} alt="Virtual Try-On Result" style={{ maxWidth: '100%', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
}