using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Captures the default Windows playback mix. Only frequency-band magnitudes leave this process.
public static class WindowsSpectrum
{
    private const int FftSize = 4096;
    private const int Bands = 64;
    private const uint Loopback = 0x00020000;
    private const uint Silent = 0x00000002;

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface DeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int flow, uint stateMask, out IntPtr collection);
        [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out Device endpoint);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface Device
    {
        [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters,
            [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    }

    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface AudioClient
    {
        [PreserveSig] int Initialize(int shareMode, uint flags, long duration, long period, IntPtr format, IntPtr session);
        [PreserveSig] int GetBufferSize(out uint frames);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint frames);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
        [PreserveSig] int GetMixFormat(out IntPtr format);
        [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr handle);
        [PreserveSig] int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }

    [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface CaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, IntPtr position, IntPtr clock);
        [PreserveSig] int ReleaseBuffer(uint frames);
        [PreserveSig] int GetNextPacketSize(out uint frames);
    }

    private static void Check(int result)
    {
        if (result < 0) Marshal.ThrowExceptionForHR(result);
    }

    private sealed class Transform
    {
        private readonly double[] real = new double[FftSize];
        private readonly double[] imaginary = new double[FftSize];
        private readonly double[] window = new double[FftSize];
        private readonly int[] reverse = new int[FftSize];
        private readonly int[] starts = new int[Bands + 1];

        public Transform(int sampleRate)
        {
            for (int i = 0, index = 0; i < FftSize; i++)
            {
                window[i] = 0.5 - 0.5 * Math.Cos(2 * Math.PI * i / (FftSize - 1));
                reverse[i] = index;
                int bit = FftSize / 2;
                while (bit != 0 && (index & bit) != 0)
                {
                    index ^= bit;
                    bit >>= 1;
                }
                index ^= bit;
            }
            double upper = Math.Min(16000, sampleRate * 0.45);
            for (int i = 0; i <= Bands; i++)
            {
                double hz = 35 * Math.Pow(upper / 35, i / (double)Bands);
                starts[i] = Math.Max(1, (int)Math.Round(hz * FftSize / sampleRate));
            }
        }

        public void Write(float[] samples, int next, byte[] output, int offset)
        {
            for (int i = 0; i < FftSize; i++)
            {
                real[reverse[i]] = samples[(next + i) % FftSize] * window[i];
                imaginary[reverse[i]] = 0;
            }
            for (int length = 2; length <= FftSize; length *= 2)
            {
                int half = length / 2;
                double theta = -2 * Math.PI / length;
                double stepReal = Math.Cos(theta);
                double stepImaginary = Math.Sin(theta);
                for (int start = 0; start < FftSize; start += length)
                {
                    double wr = 1, wi = 0;
                    for (int i = start; i < start + half; i++)
                    {
                        int j = i + half;
                        double r = wr * real[j] - wi * imaginary[j];
                        double m = wr * imaginary[j] + wi * real[j];
                        real[j] = real[i] - r;
                        imaginary[j] = imaginary[i] - m;
                        real[i] += r;
                        imaginary[i] += m;
                        double nextReal = wr * stepReal - wi * stepImaginary;
                        wi = wr * stepImaginary + wi * stepReal;
                        wr = nextReal;
                    }
                }
            }
            for (int band = 0; band < Bands; band++)
            {
                double peak = 0;
                int end = Math.Max(starts[band] + 1, starts[band + 1]);
                for (int bin = starts[band]; bin < end; bin++)
                    peak = Math.Max(peak, real[bin] * real[bin] + imaginary[bin] * imaginary[bin]);
                double level = 10 * Math.Log10(Math.Max(peak * 16 / (FftSize * FftSize), 1e-12));
                output[offset + band] = (byte)Math.Round(255 * Math.Max(0, Math.Min(1, (level + 68) / 60)));
            }
        }
    }

    private static float Sample(byte[] bytes, int offset, int bits, bool floating)
    {
        if (floating)
        {
            float value = BitConverter.ToSingle(bytes, offset);
            return float.IsNaN(value) || float.IsInfinity(value) ? 0 : value;
        }
        if (bits == 16) return BitConverter.ToInt16(bytes, offset) / 32768f;
        if (bits == 32) return BitConverter.ToInt32(bytes, offset) / 2147483648f;
        int value24 = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
        return ((value24 << 8) >> 8) / 8388608f;
    }

    public static void Run()
    {
        var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
        var enumerator = (DeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(clsid));
        Device endpoint = null;
        AudioClient client = null;
        CaptureClient capture = null;
        IntPtr format = IntPtr.Zero;
        try
        {
            Check(enumerator.GetDefaultAudioEndpoint(0, 1, out endpoint)); // Render, Multimedia.
            var iid = typeof(AudioClient).GUID;
            object service;
            Check(endpoint.Activate(ref iid, 23, IntPtr.Zero, out service)); // CLSCTX_ALL.
            client = (AudioClient)service;
            Check(client.GetMixFormat(out format));
            int tag = (ushort)Marshal.ReadInt16(format, 0);
            int channels = (ushort)Marshal.ReadInt16(format, 2);
            int rate = Marshal.ReadInt32(format, 4);
            int stride = (ushort)Marshal.ReadInt16(format, 12);
            int bits = (ushort)Marshal.ReadInt16(format, 14);
            if (tag == 0xfffe && (ushort)Marshal.ReadInt16(format, 16) >= 22)
                tag = Marshal.ReadInt32(format, 24); // First DWORD of the extensible subformat GUID.
            bool floating = tag == 3;
            int sampleBytes = bits / 8;
            if (channels < 1 || rate < 8000 || stride < channels * sampleBytes ||
                !(floating ? bits == 32 : tag == 1 && (bits == 16 || bits == 24 || bits == 32)))
                throw new NotSupportedException("Unsupported Windows playback mix format.");

            Check(client.Initialize(0, Loopback, 1000000, 0, format, IntPtr.Zero));
            iid = typeof(CaptureClient).GUID;
            Check(client.GetService(ref iid, out service));
            capture = (CaptureClient)service;
            Check(client.Start());
            Console.WriteLine("READY");

            var fft = new Transform(rate);
            var left = new float[FftSize];
            var right = new float[FftSize];
            var bands = new byte[Bands * 2];
            byte[] packet = new byte[0];
            var time = Stopwatch.StartNew();
            long lastPacket = -200, lastFrame = -40;
            int next = 0;
            while (true)
            {
                uint frames;
                Check(capture.GetNextPacketSize(out frames));
                while (frames != 0)
                {
                    IntPtr buffer;
                    uint flags;
                    Check(capture.GetBuffer(out buffer, out frames, out flags, IntPtr.Zero, IntPtr.Zero));
                    try
                    {
                        bool silence = (flags & Silent) != 0;
                        if (!silence)
                        {
                            int size = checked((int)frames * stride);
                            if (packet.Length < size) packet = new byte[size];
                            Marshal.Copy(buffer, packet, 0, size);
                        }
                        for (int i = 0; i < frames; i++)
                        {
                            int index = i * stride;
                            left[next] = silence ? 0 : Sample(packet, index, bits, floating);
                            right[next] = silence || channels == 1 ? left[next] : Sample(packet, index + sampleBytes, bits, floating);
                            next = (next + 1) % FftSize;
                        }
                        lastPacket = time.ElapsedMilliseconds;
                    }
                    finally { Check(capture.ReleaseBuffer(frames)); }
                    Check(capture.GetNextPacketSize(out frames));
                }
                long now = time.ElapsedMilliseconds;
                if (now - lastFrame >= 40)
                {
                    if (now - lastPacket > 160)
                    {
                        Array.Clear(left, 0, left.Length);
                        Array.Clear(right, 0, right.Length);
                        Array.Clear(bands, 0, bands.Length);
                    }
                    else
                    {
                        fft.Write(left, next, bands, 0);
                        fft.Write(right, next, bands, Bands);
                    }
                    Console.WriteLine(Convert.ToBase64String(bands));
                    lastFrame = now;
                }
                Thread.Sleep(10);
            }
        }
        finally
        {
            if (client != null) client.Stop();
            if (format != IntPtr.Zero) Marshal.FreeCoTaskMem(format);
            if (capture != null) Marshal.ReleaseComObject(capture);
            if (client != null) Marshal.ReleaseComObject(client);
            if (endpoint != null) Marshal.ReleaseComObject(endpoint);
            Marshal.ReleaseComObject(enumerator);
        }
    }

    // Deterministic signal for validating the same transform used in capture.
    public static byte[] TestTone(double frequency)
    {
        const int rate = 48000;
        var input = new float[FftSize];
        for (int i = 0; i < input.Length; i++) input[i] = (float)(0.25 * Math.Sin(2 * Math.PI * frequency * i / rate));
        var output = new byte[Bands];
        new Transform(rate).Write(input, 0, output, 0);
        return output;
    }
}
