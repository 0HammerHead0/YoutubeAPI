import React, { useState, useEffect } from 'react';

const categories = [
  { id: 1, name: 'Film & Animation' },
  { id: 2, name: 'Autos & Vehicles' },
  { id: 10, name: 'Music' },
  { id: 15, name: 'Pets & Animals' },
  { id: 17, name: 'Sports' },
  { id: 18, name: 'Short Movies' },
  { id: 19, name: 'Travel & Events' },
  { id: 20, name: 'Gaming' },
  { id: 21, name: 'Videoblogging' },
  { id: 22, name: 'People & Blogs' },
  { id: 23, name: 'Comedy' },
  { id: 24, name: 'Entertainment' },
  { id: 25, name: 'News & Politics' },
  { id: 26, name: 'Howto & Style' },
  { id: 27, name: 'Education' },
  { id: 28, name: 'Science & Technology' },
  { id: 29, name: 'Nonprofits & Activism' },
  { id: 30, name: 'Movies' },
  { id: 31, name: 'Anime/Animation' },
  { id: 32, name: 'Action/Adventure' },
  { id: 33, name: 'Classics' },
  { id: 34, name: 'Comedy' },
  { id: 35, name: 'Documentary' },
  { id: 36, name: 'Drama' },
  { id: 37, name: 'Family' },
  { id: 38, name: 'Foreign' },
  { id: 39, name: 'Horror' },
  { id: 40, name: 'Sci-Fi/Fantasy' },
  { id: 41, name: 'Thriller' },
  { id: 42, name: 'Shorts' },
  { id: 43, name: 'Shows' },
  { id: 44, name: 'Trailers' },
];
const oauthIds = [
  { id: 'random-meme-dump', name: 'Random Meme Dump' },
  { id: 'i-msg', name: 'i message' },
  { id: 'streamer-clips', name: 'Streamer Clips' },
  { id: 'female-streamers', name: 'Female Streamers' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'podcasts-clips', name: 'Podcasts Clips' },
];

function App() {
  const [videos, setVideos] = useState([]); // To store the list of videos and their data
  const [interval, setInterval] = useState(60); // Default interval (in minutes)
  const [commonFields, setCommonFields] = useState({
    title: '',
    description: '',
    category: '23',
    keywords: '',
    privacyStatus: 'public',
    publishAt: '',
  });

  const [selectedOauthId, setSelectedOauthId] = useState('');
  
  const handleOauthIdChange = (e) => {
    setSelectedOauthId(e.target.value);
    // Reset the 'uploaded' status to false for all videos when OAuth ID changes
    const updatedVideos = videos.map((video) => ({
      ...video,
      uploaded: false, // Reset the uploaded status
    }));
    setVideos(updatedVideos);
  };
  const handleApplyInterval = () => {
    if (commonFields.publishAt && interval) {
      const baseTime = new Date(commonFields.publishAt).getTime();
      const intervalMillis = interval * 60 * 1000; // Convert interval to milliseconds
  
      const updatedVideos = videos.map((video, index) => {
        const newPublishAt = new Date(baseTime + index * intervalMillis).toISOString().slice(0, 16);
        return { ...video, publishAt: newPublishAt };
      });
      setVideos(updatedVideos);
    }
  };
   
  // Effect to instantly update all videos when common fields are changed
  useEffect(() => {
    const updatedVideos = videos.map((video) => ({
      ...video,
      title: commonFields.title || video.title,
      description: commonFields.description || video.description,
      privacyStatus: commonFields.privacyStatus || video.privacyStatus,
      category: commonFields.category || video.category,
    }));
    setVideos(updatedVideos);
  }, [commonFields.title, commonFields.description, commonFields.privacyStatus, commonFields.category]);

  const handleKeywordsAppend = (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      const updatedVideos = videos.map((video) => ({
        ...video,
        keywords: video.keywords
          ? `${video.keywords}, ${commonFields.keywords}` // Append new keywords
          : commonFields.keywords,
      }));
      setVideos(updatedVideos);
    }
  };

  // Effect to update the 'publishAt' field in arithmetic progression when publish time and interval are set
  useEffect(() => {
    if (commonFields.publishAt && interval) {
      const baseTime = new Date(commonFields.publishAt).getTime();
      const intervalMillis = interval * 60 * 1000; // Convert interval to milliseconds

      const updatedVideos = videos.map((video, index) => {
        const newPublishAt = new Date(baseTime + index * intervalMillis)
          .toISOString()
          .slice(0, 16);
        return { ...video, publishAt: newPublishAt };
      });
      setVideos(updatedVideos);
    }
  }, [commonFields.publishAt, interval]);

  const handleVideoSelect = (event) => {
    const selectedVideos = Array.from(event.target.files);
    const videoData = selectedVideos.map((video) => ({
      file: video,
      title: commonFields.title || video.name,
      description: commonFields.description,
      category: commonFields.category,
      keywords: commonFields.keywords,
      privacyStatus: commonFields.privacyStatus,
      publishAt: commonFields.publishAt,
      uploaded: false, // Add uploaded status
    }));
    setVideos((prevVideos) => [...prevVideos, ...videoData]);
  };

  const handleCommonFieldChange = (e) => {
    setCommonFields({
      ...commonFields,
      [e.target.name]: e.target.value,
    });
  };

  const handleCategoryChange = (e) => {
    const selectedCategory = categories.find(
      (category) => category.id === Number(e.target.value)
    );
    setCommonFields({
      ...commonFields,
      category: selectedCategory.id, // Store the category ID instead of the name
    });
  };

  const handleIndividualFieldChange = (index, field, value) => {
    const updatedVideos = [...videos];
    updatedVideos[index][field] = value;
    setVideos(updatedVideos);
  };

  const handleDelete = (index) => {
    const updatedVideos = videos.filter((_, i) => i !== index);
    setVideos(updatedVideos);
  };

  const handleIntervalChange = (e) => {
    setInterval(e.target.value);
  };
  const handleSubmit = async () => {
    if (!selectedOauthId) {
      alert('Please select an OAuth2 ID to upload the video.');
      return;
    }
  
    // Function to upload each video sequentially
    const uploadVideo = async (video, index) => {
      const formData = new FormData();
      formData.append('video', video.file);
      formData.append('title', video.title);
      formData.append('description', video.description);
      formData.append('category', video.category); // Sends category ID
      formData.append('keywords', video.keywords);
      formData.append('privacyStatus', video.privacyStatus);
      formData.append('publishAt', video.publishAt);
  
      try {
        const response = await fetch(`http://127.0.0.1:5000/upload/${selectedOauthId}`, {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload the video.');
        }
  
        const result = await response.json();
        console.log(result);
  
        // Mark the video as uploaded
        const updatedVideos = [...videos];
        updatedVideos[index].uploaded = true;
        setVideos(updatedVideos);
  
        // Automatically delete the video from the list after upload
        // setVideos((prevVideos) => prevVideos.filter((_, i) => i !== index));
  
      } catch (error) {
        console.error('Upload error:', error.message);
      }
    };
  
    // Upload videos sequentially
    for (let i = 0; i < videos.length; i++) {
      await uploadVideo(videos[i], i); // Wait for each video to upload before continuing
    }
  };
  

  return (
    <div className="bg-zinc-800 h-screen min-w-screen flex items- justify-center overflow-hidden text-white">
      <div className="bg-zine-800 shadow-lg rounded-lg p-8 w-full h-full overflow-y-auto">
        <h1 className="text-2xl font-semibold mb-2 text-left">Upload Video to YouTube</h1>
        <select
          name="oauthId"
          onChange={handleOauthIdChange}
          className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500 mb-4"
        >
          <option value="">Select Account</option>
          {oauthIds.map((oauth) => (
            <option key={oauth.id} value={oauth.id}>
              {oauth.name}
            </option>
          ))}
        </select>
        {/* Video Input */}
        <div className="mb-6">
          <label>Select Videos:</label>
          <input
            type="file"
            multiple
            accept="video/*"
            onChange={handleVideoSelect}
            className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
          />
        </div>

        {/* Common Fields - Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div>
            <label>Title:</label>
            <input
              type="text"
              name="title"
              onChange={handleCommonFieldChange}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            />
          </div>
          <div>
            <label>Description:</label>
            <textarea
              name="description"
              onChange={handleCommonFieldChange}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            ></textarea>
          </div>
          <div>
            <label>Category:</label>
            <select
              name="category"
              onChange={handleCategoryChange} // Custom handler for category selection
              value={commonFields.category}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Keywords:</label>
            <input
              type="text"
              name="keywords"
              onChange={handleCommonFieldChange}
              onKeyDown={handleKeywordsAppend}
              onBlur={handleKeywordsAppend}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            />
          </div>
          <div>
            <label>Privacy Status:</label>
            <select
              name="privacyStatus"
              onChange={handleCommonFieldChange}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </div>
          <div>
            <label>Publish At:</label>
            <input
              type="datetime-local"
              name="publishAt"
              onChange={handleCommonFieldChange}
              className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
            />
          </div>
        </div>

        {/* Interval Upload */}
        <div className="mb-6 flex flex-row justify-between">
          <div>
            <label>Interval (minutes):</label>
            <input
              type="number"
              value={interval}
              onChange={handleIntervalChange}
              className="border rounded w-32 px-3 py-2 mr-4 bg-zinc-700 border-zinc-500"
            />
            </div>
          <button
            onClick={handleApplyInterval}
            className="px-4 py-2 bg-blue-500 text-white rounded"
            >
            Apply Interval
          </button>
          <button onClick={handleSubmit} className=" px-4 py-2 bg-green-500 text-white rounded">
            Submit Videos
          </button>
        </div>

        {/* Video List */}
        {videos.length>0 && <h3 className="text-xl font-bold mb-4">Video List</h3>}
        <ul className="space-y-4">
          {videos.map((video, index) => (
            <li key={index} className="border p-4 rounded-lg">
              <h4 className="font-bold">{video.file.name}</h4>
              <div className="mb-2">
                <label>Title:</label>
                <input
                  type="text"
                  value={video.title}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'title', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                />
              </div>
              <div className="mb-2">
                <label>Description:</label>
                <textarea
                  value={video.description}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'description', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                ></textarea>
              </div>
              <div className="mb-2">
                <label>Category:</label>
                <select
                  value={video.category}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'category', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label>Keywords:</label>
                <input
                  type="text"
                  value={video.keywords}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'keywords', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                />
              </div>
              <div className="mb-2">
                <label>Publish At:</label>
                <input
                  type="datetime-local"
                  value={video.publishAt}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'publishAt', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                />
              </div>
              <div className="mb-2">
                <label>Privacy Status:</label>
                <select
                  value={video.privacyStatus}
                  onChange={(e) =>
                    handleIndividualFieldChange(index, 'privacyStatus', e.target.value)
                  }
                  className="border rounded w-full px-3 py-2 bg-zinc-700 border-zinc-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>
              {/* Delete Button */}
              <div className="flex justify-between">
                <button
                  onClick={() => handleDelete(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
                {/* Success Indicator */}
                {video.uploaded ? (
                  <span className="text-green-500 font-bold">Uploaded ✓</span>
                ) : (
                  <span className="text-red-500">Not yet uploaded</span>
                )}
              </div>

            </li>
          ))}
        </ul>

        {/* Submit Button */}
        <button onClick={handleSubmit} className="mt-6 px-4 py-2 bg-green-500 text-white rounded">
          Submit Videos
        </button>
      </div>
    </div>
  );
}

export default App;
