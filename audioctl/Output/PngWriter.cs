using System.Buffers.Binary;
using System.IO.Compression;

namespace AudioCtl.Output;

// Minimal PNG encoder (8-bit RGBA, filter None, no interlace): NativeAOT ships no
// imaging library, and one fixed format is all app-icon needs.
internal static class PngWriter
{
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly uint[] CrcTable = BuildCrcTable();

    public static byte[] Write(int width, int height, byte[] rgba)
    {
        if (rgba.Length != width * height * 4)
            throw new ArgumentException("pixel buffer does not match dimensions");

        using var output = new MemoryStream();
        output.Write(Signature);

        Span<byte> ihdr = stackalloc byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr, width);
        BinaryPrimitives.WriteInt32BigEndian(ihdr[4..], height);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 6; // color type RGBA
        WriteChunk(output, "IHDR", ihdr);

        // Raw stream: each scanline prefixed with filter byte 0 (None).
        int stride = width * 4;
        var raw = new byte[height * (1 + stride)];
        for (int y = 0; y < height; y++)
            rgba.AsSpan(y * stride, stride).CopyTo(raw.AsSpan(y * (1 + stride) + 1));
        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
        {
            zlib.Write(raw);
        }
        WriteChunk(output, "IDAT", compressed.ToArray());

        WriteChunk(output, "IEND", ReadOnlySpan<byte>.Empty);
        return output.ToArray();
    }

    private static void WriteChunk(Stream output, string type, ReadOnlySpan<byte> data)
    {
        Span<byte> header = stackalloc byte[8];
        BinaryPrimitives.WriteInt32BigEndian(header, data.Length);
        for (int i = 0; i < 4; i++) header[4 + i] = (byte)type[i];
        output.Write(header);
        output.Write(data);
        uint crc = 0xFFFFFFFFu;
        foreach (byte b in header[4..]) crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        foreach (byte b in data) crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, crc ^ 0xFFFFFFFFu);
        output.Write(crcBytes);
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            uint c = n;
            for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[n] = c;
        }
        return table;
    }
}
