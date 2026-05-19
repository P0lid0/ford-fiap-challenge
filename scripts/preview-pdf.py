import fitz, os, sys

pdf = sys.argv[1] if len(sys.argv) > 1 else "docs/deliverables/Relatorio_Desafio_2_ML.pdf"
out_dir = os.environ.get("TEMP", "C:/Temp")
doc = fitz.open(pdf)
print(f"pages: {doc.page_count}")
for i in range(min(doc.page_count, 8)):
    pix = doc[i].get_pixmap(dpi=100)
    p = os.path.join(out_dir, f"pdf-p{i+1}.png").replace("\\", "/")
    pix.save(p)
    print(p)
