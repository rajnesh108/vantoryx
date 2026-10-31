# CPU-only Windows installation of llama.cpp

## Step 1. Check your system specifications

```powershell
Get-CimInstance Win32_Processor |
  Select-Object Name, NumberOfCores, NumberOfLogicalProcessors

Get-CimInstance Win32_ComputerSystem |
  Select-Object @{N="RAM_GB";E={[math]::Round($_.TotalPhysicalMemory / 1GB, 2)}}

Get-CimInstance Win32_OperatingSystem |
  Select-Object Caption, OSArchitecture
```

This tells us:

- Processor model.
- Number of CPU cores and threads.
- Installed RAM.
- Windows architecture.

## Step 2. Install llama.cpp

```powershell
winget install llama.cpp
llama-cli --version
llama-server --help
```

## Step 3. Create the Vantoryx local AI directory

```powershell
New-Item -ItemType Directory -Force -Path `
  "C:\Users\Username\AI\llma\llama.cpp", `
  "C:\Users\Username\AI\llma\models", `
  "C:\Users\Username\AI\llma\logs"
```

## Step 4. Download your first GGUF model

Model page: [Qwen/Qwen2.5-1.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)

### Verify Hugging Face installation

```powershell
py -m pip install -U huggingface_hub
py -m pip show huggingface_hub
```

### Download using Python

Navigate to your models directory. This downloads the GGUF file without requiring `hf` or `huggingface-cli` on `PATH`.

```powershell
py -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='Qwen/Qwen2.5-1.5B-Instruct-GGUF', filename='qwen2.5-1.5b-instruct-q5_k_m.gguf', local_dir='.')"
```

### Verify the download

PowerShell:

```powershell
Get-ChildItem *.gguf
```

Command Prompt:

```bat
dir *.gguf
```

You should see:

```text
qwen2.5-1.5b-instruct-q5_k_m.gguf
```

### If Python is not recognized

```powershell
py --version
python --version
```

Why start with 1.5B?

- Lower memory requirements.
- Faster initial CPU inference.
- Good for testing the inference pipeline.
- Lets us establish a performance baseline before testing larger models.

## Step 5. Run your first inference

Navigate to your llama.cpp directory. The first run uses:

- Model: Qwen2.5-1.5B-Instruct Q5_K_M
- Inference engine: llama.cpp
- Language: C++
- Terminal: Windows CMD
- Initial target: CPU inference. NVIDIA CUDA can be enabled afterward.

### Install prerequisites

You need:

1. Git for Windows.
2. CMake.
3. Visual Studio 2022 with the Desktop development with C++ workload.

Check whether they are installed:

```bat
git --version
cmake --version
```

If CMake is not installed, download the Windows x64 Installer (`.msi`) from the [CMake download page](https://cmake.org/download/).

### Download the llama.cpp source code

Navigate to `C:\Users\Username\AI\llma` and clone the official repository:

```bat
git clone https://github.com/ggml-org/llama.cpp.git
```

This downloads the source code into `C:\Users\Username\AI\llma\llama.cpp`.

### Build llama.cpp (CPU version)

Open **x64 Native Tools Command Prompt for VS 2022** from the Windows Start menu.

If that prompt is missing, download [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/downloads/) and select **Desktop development with C++**. Ensure these components are selected:

- MSVC v143 - VS 2022 C++ x64/x86 build tools
- Windows 10 or Windows 11 SDK
- C++ CMake tools for Windows

Then:

```bat
cd /d C:\Users\Username\AI\llma\llama.cpp
cmake -B build
cmake --build build --config Release -j 8
```

Wait for compilation to finish. This creates the llama.cpp executable files.

### Verify the executable

```bat
dir build\bin\Release\llama-cli.exe
```

You should find `llama-cli.exe`.

### Run the model

```bat
build\bin\Release\llama-cli.exe ^
  -m "C:\Users\Username\AI\llma\models\qwen2.5-1.5b-instruct-q5_k_m.gguf" ^
  -p "Explain how artificial intelligence works." ^
  -n 200
```

### Start the local inference API

```bat
build\bin\Release\llama-server.exe ^
  -m "C:\Users\Username\AI\llma\models\qwen2.5-1.5b-instruct-q5_k_m.gguf" ^
  --host 127.0.0.1 ^
  --port 8081 ^
  -c 4096
```
