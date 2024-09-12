import http.client as httplib
import httplib2
import os
import random
import sys
import time
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from oauth2client.client import flow_from_clientsecrets
from oauth2client.file import Storage
from oauth2client.tools import run_flow
from flask import Flask, request, jsonify
import os
import shutil
from werkzeug.utils import secure_filename
from flask_cors import cross_origin, CORS

httplib2.RETRIES = 1
MAX_RETRIES = 10

RETRIABLE_EXCEPTIONS = (httplib2.HttpLib2Error, OSError, httplib.NotConnected,
                        httplib.IncompleteRead, httplib.ImproperConnectionState,
                        httplib.CannotSendRequest, httplib.CannotSendHeader,
                        httplib.ResponseNotReady, httplib.BadStatusLine)

RETRIABLE_STATUS_CODES = [500, 502, 503, 504]
CLIENT_SECRETS_FILE = "client_secrets.json"

YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

MISSING_CLIENT_SECRETS_MESSAGE = f"""
WARNING: Please configure OAuth 2.0

To make this sample run you will need to populate the client_secrets.json file
found at:

   {os.path.abspath(os.path.join(os.path.dirname(__file__),
                                 CLIENT_SECRETS_FILE))}

with information from the API Console
https://console.cloud.google.com/
"""


VALID_PRIVACY_STATUSES = ("public", "private", "unlisted")


def get_authenticated_service():
    flow = flow_from_clientsecrets(CLIENT_SECRETS_FILE,
                                   scope=YOUTUBE_UPLOAD_SCOPE,
                                   message=MISSING_CLIENT_SECRETS_MESSAGE)

    storage = Storage(f"{sys.argv[0]}-oauth2.json")
    credentials = storage.get()

    if credentials is None or credentials.invalid:
        credentials = run_flow(flow, storage)

    return build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION,
                 credentials=credentials)


def initialize_upload(youtube, file_path, title, description, category, tags, privacyStatus, publishAt):
    body = dict(
        snippet=dict(
            title=title,
            description=description,
            tags=tags,
            categoryId=category
        ),
        status=dict(
            privacyStatus=privacyStatus,
            selfDeclaredMadeForKids=False,
            publishAt=publishAt
        )
    )

    insert_request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(file_path, chunksize=-1, resumable=True)
    )

    resumable_upload(insert_request)


def resumable_upload(insert_request):
    response = None
    error = None
    retry = 0
    while response is None:
        try:
            print("Uploading file...")
            status, response = insert_request.next_chunk()
            if response:
                if 'id' in response:
                    print(f"Video id '{response['id']}' was successfully uploaded.")
                else:
                    sys.exit(f"The upload failed with an unexpected response: {response}")
        except HttpError as e:
            if e.resp.status in RETRIABLE_STATUS_CODES:
                error = f"A retriable HTTP error {e.resp.status} occurred:\n{e.content}"
            else:
                raise
        except RETRIABLE_EXCEPTIONS as e:
            error = f"A retriable error occurred: {e}"

        if error:
            print(error)
            retry += 1
            if retry > MAX_RETRIES:
                sys.exit("No longer attempting to retry.")

            max_sleep = 2 ** retry
            sleep_seconds = random.random() * max_sleep
            print(f"Sleeping {sleep_seconds} seconds and then retrying...")
            time.sleep(sleep_seconds)


def main(file_path, title, description, category, keywords, privacyStatus, publishAt=None):
    if not os.path.exists(file_path):
        sys.exit("Please specify a valid file path.")

    youtube = get_authenticated_service()
    try:
        initialize_upload(youtube, file_path, title, description, category, keywords, privacyStatus, publishAt)
    except HttpError as e:
        print(f"An HTTP error {e.resp.status} occurred:\n{e.content}")

app = Flask(__name__)
CORS(app)
# Specify the folder where uploaded files will be stored
UPLOAD_FOLDER = 'temp_uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Make sure the folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def clear_upload_folder():
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        shutil.rmtree(app.config['UPLOAD_FOLDER'])
    os.makedirs(app.config['UPLOAD_FOLDER'])

@app.route('/upload', methods=['POST'])
def upload_video():
    clear_upload_folder()
    # Get the file from the request
    video = request.files.get('video')
    title = request.form.get('title')
    description = request.form.get('description')
    category = request.form.get('category')
    keywords = request.form.getlist('keywords')
    privacy_status = request.form.get('privacyStatus')
    publish_at = request.form.get('publishAt')

    if not video:
        return jsonify({'error': 'No video provided'}), 400

    # Secure the filename and save it
    video_filename = secure_filename(video.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], video_filename)
    video.save(file_path)

    # Call the main function with provided data
    try:
        main(file_path, title, description, category, keywords, privacy_status, publish_at)
        return jsonify({'status': 'Video upload and processing started'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000,debug=True)