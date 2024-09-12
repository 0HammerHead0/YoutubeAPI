import React, { useState } from 'react';

function App() {
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);

    try {
      const response = await fetch('http://127.0.0.1:5000/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload the video.');
      }

      const result = await response.json();

      setStatusMessage(<p className="text-green-500">{result.status}</p>);
    } catch (error) {
      setStatusMessage(
        <p className="text-red-500">An error occurred: {error.message}</p>
      );
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Upload Video to YouTube
        </h1>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* Video Upload */}
          <div className="mb-4">
            <label
              htmlFor="video"
              className="block text-gray-700 font-bold mb-2"
            >
              Video File:
            </label>
            <input
              type="file"
              id="video"
              name="video"
              accept="video/*"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-gray-700 font-bold mb-2"
            >
              Title:
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-gray-700 font-bold mb-2"
            >
              Description:
            </label>
            <textarea
              id="description"
              name="description"
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            ></textarea>
          </div>

          {/* Category */}
          <div className="mb-4">
            <label
              htmlFor="category"
              className="block text-gray-700 font-bold mb-2"
            >
              Category:
            </label>
            <input
              type="text"
              id="category"
              name="category"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          {/* Keywords */}
          <div className="mb-4">
            <label
              htmlFor="keywords"
              className="block text-gray-700 font-bold mb-2"
            >
              Keywords (comma-separated):
            </label>
            <input
              type="text"
              id="keywords"
              name="keywords"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          {/* Privacy Status */}
          <div className="mb-4">
            <label
              htmlFor="privacyStatus"
              className="block text-gray-700 font-bold mb-2"
            >
              Privacy Status:
            </label>
            <select
              id="privacyStatus"
              name="privacyStatus"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </div>

          {/* Publish Date */}
          <div className="mb-4">
            <label
              htmlFor="publishAt"
              className="block text-gray-700 font-bold mb-2"
            >
              Publish At (Optional):
            </label>
            <input
              type="datetime-local"
              id="publishAt"
              name="publishAt"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-2 rounded shadow hover:bg-blue-600"
            >
              Upload Video
            </button>
          </div>
        </form>

        {/* Status Message */}
        <div id="statusMessage" className="mt-4 text-center">
          {statusMessage}
        </div>
      </div>
    </div>
  );
}

export default App;
