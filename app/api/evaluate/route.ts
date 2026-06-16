import { NextResponse } from 'next/server';
import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';

// Global cache for the working python command
let cachedPythonCmd: string | null = null;

function testPythonCmd(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Run a quick import test to see if it is a real python interpreter
    exec(`${cmd} -c "import sys"`, (error) => {
      resolve(!error);
    });
  });
}

async function getPythonCommand(): Promise<string> {
  if (cachedPythonCmd) return cachedPythonCmd;
  
  const commands = ['python', 'py', 'python3'];
  for (const cmd of commands) {
    const isWorking = await testPythonCmd(cmd);
    if (isWorking) {
      cachedPythonCmd = cmd;
      return cmd;
    }
  }
  
  throw new Error(`Could not find a working Python executable. Tried commands: ${commands.join(', ')}. Please verify that Python is installed, added to your PATH, and you have run 'pip install networkx'.`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Path to the Python script at the project root
    const scriptPath = path.join(process.cwd(), 'evaluate.py');
    
    // Find the working python command
    let pythonCmd: string;
    try {
      pythonCmd = await getPythonCommand();
    } catch (err: any) {
      console.error(err.message);
      return NextResponse.json(
        { error: err.message },
        { status: 500 }
      );
    }
    
    // Spawn python process
    const pythonProcess = spawn(pythonCmd, ['-u', scriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Write request body JSON to python stdin
    pythonProcess.stdin!.write(JSON.stringify(body));
    pythonProcess.stdin!.end();
    
    // Read stdout
    for await (const chunk of pythonProcess.stdout!) {
      stdoutData += chunk;
    }
    
    // Read stderr
    for await (const chunk of pythonProcess.stderr!) {
      stderrData += chunk;
    }
    
    const code = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });
    
    if (code !== 0) {
      console.error(`Python script exited with code ${code}. Stderr: ${stderrData}`);
      return NextResponse.json(
        { error: `Python execution failed: ${stderrData || 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    const result = JSON.parse(stdoutData);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
