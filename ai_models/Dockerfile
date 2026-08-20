# Use a lightweight official Python image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file first to leverage Docker cache
COPY requirements.txt .

# Install all Python dependencies globally inside the container
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the Python source code
COPY . .

# Expose port 5000 for the Node.js backend to communicate with
EXPOSE 5000

# Command to run the Flask server
# NOTE: Ensure your analyzer.py runs Flask on host='0.0.0.0'
CMD ["python", "analyzer.py"]