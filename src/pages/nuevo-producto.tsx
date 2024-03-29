import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextInput, Text, Button, Textarea } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import mixpanel from "@/lib/mixpanel";

// Components
import { Layout } from "@/components";

// Utils
import { trpc } from "@/lib/trpc";
import { createProductDTO } from "@/server/trpc/validations/products";
import { uploadFile } from "@/utils/uploadFile";
import { getServerAuthSession } from "@/server/common/get-server-auth-session";

// Types
import type {
  NextPage,
  GetServerSideProps,
  InferGetServerSidePropsType,
} from "next";
import type { Session } from "next-auth";
import type { FileWithPath } from "@mantine/dropzone";
import type { CreateProductDTO } from "@/server/trpc/validations/products";

interface NewProductPageProps {
  user: Session["user"];
}

export const getServerSideProps: GetServerSideProps<
  NewProductPageProps
> = async (ctx) => {
  const session = await getServerAuthSession(ctx);

  if (!session) {
    return {
      redirect: {
        destination: "/ingresar",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: session.user,
    },
  };
};

const NewProductPage: NextPage<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = (props) => {
  const { user } = props;

  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
  } = useForm<Pick<CreateProductDTO, "name" | "description">>({
    resolver: zodResolver(
      createProductDTO.pick({ name: true, description: true })
    ),
  });

  const descriptionContent = useWatch({
    control,
    name: "description",
  });

  const handleDrop = (files: FileWithPath[]) => {
    setFiles((state) => [...state, ...files]);
    setFileError(null);
  };

  const createProductMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      setLoading(false);
      mixpanel.track("Product created");
      toast.success("Producto creado con éxito");
      setFiles([]);
      reset();
      router.push("/mis-productos");
    },
    onError: () => {
      setLoading(false);
      toast.error("Error al crear el producto");
    },
  });

  const onSubmit = async (data: Omit<CreateProductDTO, "images">) => {
    setLoading(true);

    if (files.length === 0) {
      setLoading(false);
      return setFileError("Debes subir al menos una imagen");
    }

    const images = await Promise.all(
      files.map((file) => uploadFile({ file, directory: "products" }))
    );

    createProductMutation.mutate({
      ...data,
      images,
    });
  };

  return (
    <Layout user={user}>
      <div className="mb-6 ">
        <h1 className="mb-6">Agrega un producto para hacer trueque</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <TextInput
            id="name"
            label="Nombre del producto"
            placeholder="Ej. iPhone 12"
            {...register("name")}
            error={errors.name?.message}
            description="El nombre de tu producto"
          />

          <div className="space-y-1">
            <Textarea
              id="description"
              label="Descripción"
              placeholder="Ej. iPhone 12"
              {...register("description")}
              maxLength={280}
              error={errors.description?.message}
              description="Describe tu producto para que los usuarios puedan saber más sobre él"
            />
            <span className="text-sm text-gray-500">
              {descriptionContent ? descriptionContent.length : 0}
              /280
            </span>
          </div>

          <div>
            <Text fw={500} fz="sm" className="mb-1">
              Imagenes del producto
            </Text>
            <Dropzone
              accept={IMAGE_MIME_TYPE}
              onDrop={handleDrop}
              disabled={loading}
            >
              <Text align="center">Arrastra y suelta tus imagenes</Text>
            </Dropzone>
            {fileError && (
              <span className="text-sm text-red-500">{fileError}</span>
            )}

            <div className="mt-4 flex flex-wrap gap-4">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex flex-col items-center gap-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-32 w-32 rounded-md object-cover"
                  />
                  <Text size="xs">{file.name}</Text>
                  <Button
                    type="button"
                    compact
                    variant="outline"
                    color="red"
                    onClick={() =>
                      setFiles((state) => state.filter((f) => f !== file))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button size="lg" loading={loading} type="submit">
            Crear producto
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default NewProductPage;
