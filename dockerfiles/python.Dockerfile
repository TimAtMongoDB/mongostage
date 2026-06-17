# Component fragment: Python 3.12 + pip + pymongo + motor
# FROM resolved by build command to the appropriate base layer

USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3.12 \
      python3-pip \
      git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* && \
    pip3 install --no-cache-dir --break-system-packages pymongo motor
USER mongo
